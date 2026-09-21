import { GeocodeHit } from './types';

/**
 * Forward-geocode a free-text place query.
 * Primary: the app's server-side /api/geocode route (Nominatim, cached, private).
 * Fallback: keyless Photon (OpenStreetMap-based) called directly from the client,
 * so place search still works even on static/export-only hosts where API routes
 * are unavailable. Throws only when every provider fails.
 */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const clean = q.trim();
  if (clean.length < 3) return [];

  // 1) Server-side route (Nominatim behind our API, with in-memory cache)
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(clean)}`, { signal });
    if (res.ok) {
      const data = (await res.json()) as { results?: GeocodeHit[] };
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    // fall through to the client-side fallback
  }

  // 2) Client-side fallback (Photon) for hosts where API routes don't run
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=8`,
      { signal }
    );
    if (!res.ok) throw new Error(`Photon returned ${res.status}`);
    const data = await res.json();
    const hits: GeocodeHit[] = [];
    for (const f of (data?.features as any[]) || []) {
      const p = f?.properties || {};
      const lon = Number(f?.geometry?.coordinates?.[0]);
      const lat = Number(f?.geometry?.coordinates?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const label = [p.name, p.street, p.city, p.state, p.postcode]
        .filter((v: any) => typeof v === 'string' && v.length > 0)
        .join(', ');
      hits.push({
        lat,
        lon,
        label: label || clean,
        sublabel: [p.city, p.state, p.country].filter(Boolean).join(', ') || undefined,
      });
      if (hits.length >= 8) break;
    }
    return hits;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    if (err instanceof Error && err.message.includes('Photon')) {
      throw err; // both providers failed — surface the error
    }
    // Photon responded but had no usable results — not an error, just empty
    return [];
  }
}