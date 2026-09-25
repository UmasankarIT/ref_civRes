import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp, createCitizenUser, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTS } from '@/lib/auth';
import { civicStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let phone = String(body.phone || '').replace(/\D/g, '');
    if (phone.length > 10 && phone.startsWith('91')) phone = phone.slice(-10);
    if (phone.length !== 10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 });
    }

    const otp = String(body.otp || '').trim();
    if (!verifyOtp(phone, otp)) {
      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 401 });
    }

    const user = createCitizenUser(phone, body.displayName);
    const token = await signSession(user);
    await civicStore.addAuditLog({
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: user.userId,
      actorName: user.name,
      role: 'citizen',
      action: 'auth.login.otp',
      detail: `Citizen signed in via mobile OTP (+91 ${phone}).`,
      createdAt: new Date().toISOString(),
    });

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    return res;
  } catch (error: unknown) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'Failed to verify OTP.' }, { status: 500 });
  }
}