import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { canTransition } from '@/lib/workflow';
import { IssueStatus } from '@/lib/types';
import { logAction, notifyUser } from '@/lib/events';

const VALID_STATUSES: IssueStatus[] = [
  'reported',
  'in_review',
  'verified',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
  'merged',
];

/**
 * PATCH /api/issues/:id/status
 *
 * Role-gated status transitions:
 *  - citizen             → forbidden (403)
 *  - department (staff)  → own department only; assigned→in_progress→resolved
 *  - city admin          → verify / assign / reject / reopen (never resolve)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const issueId = params.id;

    const user = await getSession(req);
    if (!user) return unauthorized('Sign in to update an issue.');
    if (isRole(user, 'citizen')) return denied('Citizens cannot change ticket state.');

    const body = await req.json();
    const { status, assignedWorkerName, assignedDepartment, departmentId, resolutionNotes, resolutionProofUrl } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const current = civicStore.getIssueById(issueId);
    if (!current) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    // State-machine + role + department-isolation assertions
    const verdict = canTransition(user, current, status);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason }, { status: 403 });
    }

    // Department staff can only touch their own routed tickets
    if (isRole(user, 'department') && current.departmentId && current.departmentId !== user.departmentId) {
      return denied('Forbidden: this ticket belongs to another department.');
    }

    const updated = civicStore.updateIssueStatus(issueId, {
      status,
      assignedWorkerName,
      assignedDepartment,
      departmentId: departmentId || (isRole(user, 'department') ? user.departmentId : undefined),
      jurisdictionCode: user.jurisdictionCode,
      resolutionNotes,
      resolutionProofUrl,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    const deptName = updated.assignedDepartment || current.departmentId || 'municipal department';
    logAction(user, `reports.${status === 'in_progress' ? 'start' : status === 'resolved' ? 'resolve' : status === 'verified' ? 'verify' : status === 'assigned' ? 'assign' : status === 'rejected' ? 'reject' : 'status'}`, `Issue ${issueId} → ${status}`, issueId);

    // Notify the reporting citizen so they can track their ticket live
    if (updated.citizenUserId) {
      const statusMsg: Record<string, string> = {
        verified: 'verified by the city admin and ready for dispatch.',
        assigned: `assigned to ${assignedWorkerName || deptName}.`,
        in_progress: 'work has started on your report.',
        resolved: 'mark as RESOLVED by field staff. Proof photo attached.',
        rejected: 'marked as rejected after review.',
      };
      notifyUser(
        updated.citizenUserId,
        `Ticket ${updated.id}`,
        `Your report is ${statusMsg[status] || `now ${status}.`}`,
        issueId
      );
    }

    return NextResponse.json({
      issue: updated,
      message: `Issue updated to '${updated.status}'.`,
    });
  } catch (error: unknown) {
    console.error('Error updating issue status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}