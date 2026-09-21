import { Issue } from './types';

const EARTH_RADIUS_METERS = 6371008.8; // WGS 84 mean radius

/**
 * Calculates geodesic distance between two WGS 84 points using the Haversine formula.
 * Accurately mirrors PostGIS ST_Distance(geography, geography).
 */
export function calculateGeodesicDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Checks if two points fall within a specified metric proximity radius.
 * PostGIS equivalent: ST_DWithin(geom1::geography, geom2::geography, thresholdMeters)
 */
export function isWithinProximity(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdMeters: number = 25
): boolean {
  const distance = calculateGeodesicDistanceMeters(lat1, lon1, lat2, lon2);
  return distance <= thresholdMeters;
}

/**
 * Finds existing active issue within spatial threshold for deduplication.
 */
export function findNearbyActiveIssue(
  lat: number,
  lng: number,
  categoryId: string,
  issues: Issue[],
  thresholdMeters: number = 25
): { issue: Issue; distanceMeters: number } | null {
  let closest: { issue: Issue; distanceMeters: number } | null = null;

  for (const issue of issues) {
    // Only aggregate against active, unresolved issues with identical category
    if (issue.categoryId !== categoryId) continue;
    if (issue.status === 'resolved' || issue.status === 'rejected') continue;

    const distance = calculateGeodesicDistanceMeters(lat, lng, issue.latitude, issue.longitude);

    if (distance <= thresholdMeters) {
      if (!closest || distance < closest.distanceMeters) {
        closest = { issue, distanceMeters: Math.round(distance * 10) / 10 };
      }
    }
  }

  return closest;
}

/**
 * Approximate Reverse Geocoder for human-friendly street labels based on coordinates
 */
export function generateMockAddress(lat: number, lng: number): string {
  const sectors = ['Outer Ring Rd', 'MG Road', 'Indiranagar 100ft Rd', 'Koramangala 4th Block', 'Whitefield Main Rd', 'HSR Sector 2'];
  const landmarks = ['Near Metro Station', 'Opposite Public Park', 'Cross Junction 3', 'Near Bus Depot', 'Water Tank Lane'];
  
  const hash = Math.abs(Math.floor(lat * 1000 + lng * 1000));
  const sector = sectors[hash % sectors.length];
  const landmark = landmarks[hash % landmarks.length];

  return `${landmark}, ${sector}`;
}
