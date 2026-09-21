import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { logAction, notifyUser } from '@/lib/events';

export const dynamic = 'force-dynamic';

/** POST /api/admin/reports/:id/merge — merge a duplicate into a primary work order. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession(req);
    if (!user) return unauthorized('Sign in to merge reports.');
    if (!isRole(user, 'city_admin')) return denied('Only the city admin can merge reports.');

    const body = await req.json();
    const primaryId = String(body.primaryIssueId || '').trim();
    if (!primaryId) {
      return NextResponse.json({ error: 'primaryIssueId is required.' }, { status: 400 });
    }

    const merged = civicStore.mergeIssue(params.id, primaryId);
    if (!merged) {
      return NextResponse.json({ error: 'Could not merge — check both issue ids.' }, { status: 400 });
    }

    logAction(user, 'reports.merge', `Merged ${params.id} into ${primaryId} (duplicate).`, primaryId);

    const secondary = civicStore.getIssueById(params.id);
    if (secondary?.citizenUserId) {
      notifyUser(secondary.citizenUserId, 'Your report was merged', `Your report was merged into ticket ${primaryId} as a duplicate. You are still subscribed to updates.`, primaryId);
    }

    return NextResponse.json({
      message: `Issue ${params.id} merged into ${primaryId}.`,
      primary: civicStore.getIssueById(primaryId),
    });
  } catch (error: unknown) {
    console.error('Error merging reports:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}