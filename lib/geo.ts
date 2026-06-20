export type LatLng = { lat: number; lng: number };

/** Parse a (lat, lng) pair from strings/numbers, returning null if either is invalid. */
export function toLatLng(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined
): LatLng | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }

  const parsedLat = typeof lat === "number" ? lat : Number.parseFloat(lat);
  const parsedLng = typeof lng === "number" ? lng : Number.parseFloat(lng);

  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : null;
}

/**
 * Straight-line (great-circle) distance in kilometres between two coordinates.
 * Pure and dependency-free — used as a resilience fallback when the Distance
 * Matrix API is unavailable.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const distance = 2 * R * Math.asin(Math.sqrt(h));

  return Math.round(distance * 100) / 100;
}
