import { NextRequest, NextResponse } from 'next/server';
import { analyzeCivicPhotoWithGemini } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { imageData, comment } = await req.json();

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      );
    }

    const analysis = await analyzeCivicPhotoWithGemini(imageData, comment);
    return NextResponse.json({ success: true, data: analysis });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error analyzing image' },
      { status: 500 }
    );
  }
}
