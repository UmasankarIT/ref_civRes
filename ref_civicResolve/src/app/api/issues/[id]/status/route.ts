import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { IssueStatus } from '@/lib/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const issueId = params.id;
    const body = await req.json();

    const { status, assignedWorkerName, assignedDepartment, resolutionNotes, resolutionProofUrl } = body;

    const validStatuses: IssueStatus[] = [
      'reported',
      'in_review',
      'verified',
      'assigned',
      'in_progress',
      'resolved',
      'rejected',
    ];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const updated = civicStore.updateIssueStatus(issueId, {
      status,
      assignedWorkerName,
      assignedDepartment,
      resolutionNotes,
      resolutionProofUrl,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
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
