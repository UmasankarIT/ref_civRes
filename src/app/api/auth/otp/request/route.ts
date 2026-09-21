import { NextRequest, NextResponse } from 'next/server';
import { issueOtp } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let phone = String(body.phone || '').replace(/\D/g, '');
    if (phone.length > 10 && phone.startsWith('91')) phone = phone.slice(-10);
    if (phone.length !== 10) {
      return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 });
    }

    const otp = issueOtp(phone);
    // Demo: no real SMS provider, so surface the OTP for instant sign-in.
    return NextResponse.json({
      ok: true,
      message: `OTP sent to +91 ${phone} (demo mode).`,
      demoOtp: otp,
    });
  } catch (error: unknown) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json({ error: 'Failed to request OTP.' }, { status: 500 });
  }
}