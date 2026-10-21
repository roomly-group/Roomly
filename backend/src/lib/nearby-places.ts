import { supabaseAdmin } from "./supabase-admin.js";

// ===================== CONFIGURATION =====================

/** OpenStreetMap Overpass endpoint used to find places around a room. */
const OVERPASS_URL = "https://overpass-api.de/api/interpreter" as const;
/** Overpass asks API clients to identify themselves. */
const OVERPASS_USER_AGENT = "Roomly/1.0 (hello@roomly.it)" as const;
/** Radius searched around the room (m). */
const NEARBY_RADIUS_M = 1000 as const;
/** Server-side wait for Overpass, which can be slow when busy (ms). */
const OVERPASS_TIMEOUT_MS = 90_000 as const;
/** Stored places older than this are recomputed on the next listing view (ms, 30 days). */
const NEARBY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Place categories with their OpenStreetMap filters (nodes and building outlines). */
const CATEGORIES: { key: NearbyPlace["category"]; filters: string[] }[] = [
  { key: "transport", filters: ['node["highway"="bus_stop"]', 'node["railway"~"^(station|subway_entrance|tram_stop)$"]'] },
  { key: "supermarket", filters: ['nwr["shop"~"^(supermarket|convenience)$"]'] },
  { key: "pharmacy", filters: ['nwr["amenity"="pharmacy"]'] },
  { key: "cafe", filters: ['nwr["amenity"~"^(cafe|bar)$"]'] },
  { key: "gym", filters: ['nwr["leisure"="fitness_centre"]'] },
  { key: "library", filters: ['nwr["amenity"="library"]'] },
];

export type NearbyPlace = {
  category: "transport" | "supermarket" | "pharmacy" | "cafe" | "gym" | "library";
  name: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance from the room (m). */
  meters: number;
};

/** Straight-line distance between two points (m). */
function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

function categoryOf(tags: Record<string, string>): NearbyPlace["category"] | null {
  if (tags.highway === "bus_stop" || tags.railway) return "transport";
  if (tags.shop) return "supermarket";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "cafe" || tags.amenity === "bar") return "cafe";
  if (tags.leisure === "fitness_centre") return "gym";
  if (tags.amenity === "library") return "library";
  return null;
}

/** The nearest place of each category within 1 km of a point, from OpenStreetMap. */
export async function fetchNearbyPlaces(exactLatitude: number, exactLongitude: number): Promise<NearbyPlace[]> {
  // Distances are measured from the rounded (~100 m) position the listing shows, so the
  // metres to several known places cannot be used to work out the exact address.
  const latitude = Number(exactLatitude.toFixed(3));
  const longitude = Number(exactLongitude.toFixed(3));
  const around = `(around:${NEARBY_RADIUS_M},${latitude},${longitude})`;
  const body = CATEGORIES.flatMap((category) => category.filters.map((filter) => `${filter}${around};`)).join("");
  const query = `[out:json][timeout:60];(${body});out center 300;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OVERPASS_USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
    const json = (await response.json()) as {
      elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
    };

    const nearest = new Map<NearbyPlace["category"], NearbyPlace>();
    for (const element of json.elements) {
      const placeLat = element.lat ?? element.center?.lat;
      const placeLon = element.lon ?? element.center?.lon;
      const category = categoryOf(element.tags ?? {});
      if (placeLat === undefined || placeLon === undefined || !category) continue;
      const meters = Math.round(metersBetween(latitude, longitude, placeLat, placeLon));
      const current = nearest.get(category);
      if (!current || meters < current.meters) {
        nearest.set(category, { category, name: element.tags?.name ?? "", latitude: placeLat, longitude: placeLon, meters });
      }
    }
    return CATEGORIES.map((category) => nearest.get(category.key)).filter((place): place is NearbyPlace => Boolean(place));
  } finally {
    clearTimeout(timer);
  }
}

/** Rooms whose places are being computed right now, so one slow lookup is not started twice. */
const inFlight = new Set<number>();

/**
 * Computes and stores the places near a room. Runs in the background after a
 * room is created or moved (and as a backfill for older rooms): the request
 * that triggers it never waits for OpenStreetMap.
 */
export function refreshNearbyPlaces(roomId: number, latitude: number, longitude: number): void {
  if (inFlight.has(roomId)) return;
  inFlight.add(roomId);
  void (async () => {
    try {
      const places = await fetchNearbyPlaces(latitude, longitude);
      const { error } = await supabaseAdmin
        .from("stanze")
        .update({ luoghi_vicini: places, luoghi_vicini_aggiornati: new Date().toISOString() })
        .eq("id", roomId);
      if (error) console.warn(`Could not store nearby places for room ${roomId}:`, error.message);
    } catch (error) {
      console.warn(`Could not compute nearby places for room ${roomId}:`, error instanceof Error ? error.message : error);
    } finally {
      inFlight.delete(roomId);
    }
  })();
}

/**
 * Stored places for a room, or undefined when there are none yet. Missing or
 * stale places start a background refresh. Tolerates the columns not existing
 * yet (migration 005 not applied): the listing simply shows no places.
 */
export async function readNearbyPlaces(
  roomId: number,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Promise<NearbyPlace[] | undefined> {
  const { data, error } = await supabaseAdmin
    .from("stanze")
    .select("luoghi_vicini, luoghi_vicini_aggiornati")
    .eq("id", roomId)
    .maybeSingle();
  if (error) return undefined;

  const row = data as { luoghi_vicini?: NearbyPlace[] | null; luoghi_vicini_aggiornati?: string | null } | null;
  const updatedAt = row?.luoghi_vicini_aggiornati ? Date.parse(row.luoghi_vicini_aggiornati) : 0;
  const stale = !row?.luoghi_vicini || Date.now() - updatedAt > NEARBY_MAX_AGE_MS;
  if (stale && latitude != null && longitude != null) refreshNearbyPlaces(roomId, latitude, longitude);
  return row?.luoghi_vicini ?? undefined;
}
