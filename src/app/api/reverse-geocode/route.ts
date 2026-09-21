import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface ReverseGeocodeResult {
  state: string | null;
  district: string | null;
  mandal: string | null;
  pincode: string | null;
}

// Small in-memory cache so repeated lookups (e.g. manual re-pin) are cheap
const cache = new Map<string, ReverseGeocodeResult>();

function emptyResult(): ReverseGeocodeResult {
  return { state: null, district: null, mandal: null, pincode: null };
}

/**
 * Reverse geocodes a WGS 84 coordinate into Indian administrative divisions:
 * State, District, Mandal (sub-district) and PIN code.
 * Uses OpenStreetMap's free Nominatim service server-side (identifying ourselves
 * via a descriptive User-Agent, per their usage policy).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid latitude/longitude.' }, { status: 400 });
  }

  const cacheKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CivicResolve-DPG/1.0 (hackathon digital public good; offline demo)',
          'Accept-Language': 'en',
        },
        // Light cache so a batch of report submissions reuses the same lookup
        cache: 'force-cache',
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      throw new Error(`Nominatim returned ${res.status}`);
    }

    const data = await res.json();
    const a = data?.address ?? {};

    // India-specific mapping:
    // - state: address.state
    // - district: address.state_district (or county when not split in OSM)
    // - mandal: address.county is commonly the mandal/taluk/tehsil in India
    // - pincode: address.postcode
    const district = a.state_district || a.county || a.municipality || null;
    const mandal = a.state_district ? a.county : a.town || a.city || a.village || null;

    const result: ReverseGeocodeResult = {
      state: a.state || null,
      district,
      mandal: mandal !== district ? mandal : a.town || a.village || null,
      pincode: a.postcode || null,
    };

    cache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Reverse Geocode] Failed to resolve location:', error);
    // Never crash the report flow if the geocoder is unreachable
    return NextResponse.json(emptyResult(), { status: 502 });
  }
}