import { NextRequest, NextResponse } from 'next/server';
import { demoAccountByEmail, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTS } from '@/lib/auth';
import { civicStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const account = demoAccountByEmail(email);
    if (!account || account.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const token = await signSession(account.user);
    await civicStore.addAuditLog({
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: account.user.userId,
      actorName: account.user.name,
      role: account.user.role,
      action: 'auth.login',
      detail: `${account.user.name} signed in (${account.user.role}).`,
      createdAt: new Date().toISOString(),
    });

    const res = NextResponse.json({ ok: true, user: account.user });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    return res;
  } catch (error: unknown) {
    console.error('Error signing in:', error);
    return NextResponse.json({ error: 'Failed to sign in.' }, { status: 500 });
  }
}