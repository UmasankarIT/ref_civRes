import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { logAction, notifyUser } from '@/lib/events';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const issueId = params.id;

    // RBAC: only citizens endorse issues (1 citizen = 1 upvote per report).
    const user = await getSession(req);
    if (!user) return unauthorized('Sign in to upvote an issue.');
    if (!isRole(user, 'citizen')) {
      return denied('Only citizens can upvote issues.');
    }

    if (await civicStore.hasUpvoted(user.userId, issueId)) {
      return NextResponse.json(
        { error: 'You have already upvoted this issue. (1 upvote per citizen per report)', code: 'ALREADY_UPVOTED' },
        { status: 409 }
      );
    }

    const recorded = await civicStore.recordUpvote(user.userId, issueId);
    const updated = await civicStore.upvoteIssue(issueId);

    if (!recorded || !updated) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
    }

    await logAction(user, 'reports.upvote', `Upvoted issue ${issueId}.`, issueId);

    const ownerId = updated.citizenUserId;
    if (ownerId) {
      await notifyUser(ownerId, 'Your issue got an endorsement', `Someone upvoted your report — priority boosted.`, issueId);
    }

    return NextResponse.json({
      issueId: updated.id,
      communityUpvotes: updated.communityUpvotes,
      priorityScore: updated.priorityScore,
      message: 'Upvote recorded. Priority score updated.',
    });
  } catch (error: unknown) {
    console.error('Error upvoting issue:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}