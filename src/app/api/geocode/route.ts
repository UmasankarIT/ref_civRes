import { NextRequest, NextResponse } from 'next/server';
import { GeocodeHit } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Small in-memory cache keyed by normalized query so repeat searches are cheap
const cache = new Map<string, GeocodeHit[]>();

/**
 * Forward-geocodes a free-text place query ("Dwaraka Nagar, Visakhapatnam",
 * "560001", "Gandhi Road") into coordinates. Uses OpenStreetMap's free
 * Nominatim search server-side with a descriptive User-Agent per their policy.
 * Powers both the map's "search anywhere" box and the report form's typed
 * location field (remote reporting when GPS is unavailable or denied).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = q.toLowerCase();
  if (cache.has(cacheKey)) {
    return NextResponse.json({ results: cache.get(cacheKey) });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=8&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'CivicResolve-DPG/1.0 (hackathon digital public good; offline demo)',
          'Accept-Language': 'en',
        },
        // Light cache so a batch of searches reuses the same lookup
        cache: 'force-cache',
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      throw new Error(`Nominatim returned ${res.status}`);
    }

    const data = await res.json();
    const results: GeocodeHit[] = (Array.isArray(data) ? data : [])
      .filter((r: any) => Number.isFinite(Number(r?.lat)) && Number.isFinite(Number(r?.lon)))
      .slice(0, 8)
      .map((r: any) => {
        const a = r.address || {};
        const city = a.city || a.town || a.village || a.county || a.state_district || a.municipality;
        const parts: string[] = [];
        if (city && !parts.includes(city)) parts.push(city);
        if (a.state && !parts.includes(a.state)) parts.push(a.state);
        if (a.postcode && !parts.includes(a.postcode)) parts.push(a.postcode);

        const display = typeof r.display_name === 'string' ? r.display_name : q;
        return {
          lat: Number(r.lat),
          lon: Number(r.lon),
          label: display.length > 110 ? `${display.slice(0, 107)}…` : display,
          sublabel: parts.join(', ') || undefined,
        };
      });

    cache.set(cacheKey, results);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Geocode] Place search failed:', error);
    // Never crash the map or report flow if the geocoder is unreachable
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}