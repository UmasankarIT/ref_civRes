import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const issueId = params.id;
    const updated = civicStore.upvoteIssue(issueId);

    if (!updated) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 });
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
