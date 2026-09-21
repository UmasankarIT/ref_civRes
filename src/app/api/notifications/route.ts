import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/notifications — status pings + proof-of-work updates for the actor. */
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to view notifications.');

  const notifications = civicStore.getNotificationsForUser(user.userId);
  const unread = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unread });
}

/** POST /api/notifications — mark all of the actor's notifications as read. */
export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to update notifications.');

  civicStore.markNotificationsRead(user.userId);
  return NextResponse.json({ ok: true });
}