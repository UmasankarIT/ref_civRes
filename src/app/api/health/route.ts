import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get('deep') === '1';
  const persistence = process.env.DATABASE_URL ? 'postgres' : 'memory';

  if (!deep) {
    return NextResponse.json({ status: 'ok', persistence, gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) });
  }

  try {
    const { civicStore } = await import('@/lib/store');
    const categories = await civicStore.getCategories();
    return NextResponse.json({ status: 'ok', persistence, categories: categories.length });
  } catch (error) {
    return NextResponse.json(
      { status: 'degraded', persistence, error: error instanceof Error ? error.message : 'store unavailable' },
      { status: 503 }
    );
  }
}
