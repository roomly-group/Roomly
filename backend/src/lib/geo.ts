/**
 * Raggio (km) entro cui una stanza viene considerata "vicina" a un'università
 * e quindi mostrata quando si cerca quell'università.
 */
export const SEARCH_RADIUS_KM = Number(process.env.SEARCH_RADIUS_KM ?? 5);

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distanza in km tra due coordinate (formula di Haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Rettangolo che contiene il cerchio di raggio `radiusKm`: serve a prefiltrare in SQL. */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(Math.cos(toRad(lat)), 0.01));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

export type UniversityPoint = {
  id: string | number;
  nome: string;
  latitudine: number | null;
  longitudine: number | null;
};

/** Università più vicina a un punto (entro il raggio), oppure null. */
export function nearestUniversity(
  lat: number,
  lon: number,
  universities: UniversityPoint[],
  radiusKm = SEARCH_RADIUS_KM,
): { university: UniversityPoint; distanceKm: number } | null {
  let best: { university: UniversityPoint; distanceKm: number } | null = null;
  for (const university of universities) {
    if (university.latitudine == null || university.longitudine == null) continue;
    const distanceKm = haversineKm(lat, lon, university.latitudine, university.longitudine);
    if (distanceKm <= radiusKm && (!best || distanceKm < best.distanceKm)) {
      best = { university, distanceKm };
    }
  }
  return best;
}
