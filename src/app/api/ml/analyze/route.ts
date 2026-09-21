import { NextRequest, NextResponse } from 'next/server';
import { analyzeIssueImage } from '@/lib/mlVision';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, categoryCode, citizenNotes } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const analysis = await analyzeIssueImage(imageUrl, categoryCode || 'ROAD_POTHOLE', citizenNotes);
    return NextResponse.json(analysis);
  } catch (error: unknown) {
    console.error('Error in ML Vision API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal ML error' },
      { status: 500 }
    );
  }
}
