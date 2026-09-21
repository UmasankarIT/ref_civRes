import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { logAction, notifyUser } from '@/lib/events';
import { CITY_ADMIN_USER_ID } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/department/reports/:id/reassign-request
 * Field staff request an administrative transfer when a ticket was
 * miscategorised. The city admin reviews and re-routes it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession(req);
    if (!user) return unauthorized('Sign in to request a reassignment.');
    if (!isRole(user, 'department')) return denied('Only field staff can request reassignment.');

    const issue = civicStore.getIssueById(params.id);
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    if (issue.departmentId && issue.departmentId !== user.departmentId) {
      return denied('Forbidden: this ticket belongs to another department.');
    }

    const body = await req.json();
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) {
      return NextResponse.json({ error: 'Please provide a reason for the reassignment request.' }, { status: 400 });
    }

    const updated = civicStore.requestReassign(issue.id, {
      byDepartment: user.departmentId || 'unknown',
      reason,
      at: new Date().toISOString(),
    });
    if (!updated) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });

    logAction(user, 'dispatch.reassign-request', `Reassignment requested for ${issue.id}: ${reason}`, issue.id);
    notifyUser(CITY_ADMIN_USER_ID, 'Reassignment requested', `${user.name} requested re-routing of ${issue.id}: ${reason}`, issue.id);

    return NextResponse.json({ issue: updated, message: 'Reassignment request sent to the city admin.' });
  } catch (error: unknown) {
    console.error('Error requesting reassignment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}