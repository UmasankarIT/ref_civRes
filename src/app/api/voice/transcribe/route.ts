import { NextRequest, NextResponse } from 'next/server';
import { transcribeVoiceNote } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const audioData = body?.audioData;
    const languageHint = String(body?.languageHint || '');

    if (!audioData || typeof audioData !== 'string' || !audioData.startsWith('data:audio/')) {
      return NextResponse.json({ error: 'An audio data URL is required.' }, { status: 400 });
    }

    const result = await transcribeVoiceNote(audioData, languageHint);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voice transcription failed.' },
      { status: 500 }
    );
  }
}
