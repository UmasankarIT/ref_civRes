import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/citizen/my-reports — citizen's own submission history + live status. */
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to view your reports.');
  if (!isRole(user, 'citizen')) return denied('Only citizens have personal report history.');

  const reports = await civicStore.getIssuesForCitizen(user.userId);
  return NextResponse.json({ reports });
}