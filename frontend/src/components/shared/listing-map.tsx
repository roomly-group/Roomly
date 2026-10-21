import { useEffect, useRef, useState } from 'react';
import { Bus, Coffee, Dumbbell, GraduationCap, Library, Pill, ShoppingCart, type LucideIcon } from 'lucide-react';
import type { ListingLocation, ListingUniversity } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { useFormat } from '@/hooks/use-format';
import 'leaflet/dist/leaflet.css';

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== CONFIGURATION =====================

/** Light basemap that matches the site palette (CARTO Positron on OpenStreetMap data). */
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' as const;
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO' as const;
/** Public Overpass endpoint used to find places around the room. */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter' as const;
/** Radius searched for nearby places (m). */
const NEARBY_RADIUS_M = 1000 as const;
/** Radius drawn around the room: its coordinates are rounded to ~100 m (m). */
const APPROX_RADIUS_M = 120 as const;
/** Average walking speed used for "min a piedi" (m per minute). */
const WALK_M_PER_MIN = 80 as const;

/** Place categories: OpenStreetMap filters, label and icon. */
const CATEGORIES: { key: string; label: TranslationKey; icon: LucideIcon; filters: string[] }[] = [
  { key: 'transport', label: 'poi.transport', icon: Bus, filters: ['node["highway"="bus_stop"]', 'node["railway"~"station|subway_entrance|tram_stop"]'] },
  { key: 'supermarket', label: 'poi.supermarket', icon: ShoppingCart, filters: ['nwr["shop"~"supermarket|convenience"]'] },
  { key: 'pharmacy', label: 'poi.pharmacy', icon: Pill, filters: ['nwr["amenity"="pharmacy"]'] },
  { key: 'cafe', label: 'poi.cafe', icon: Coffee, filters: ['nwr["amenity"~"cafe|bar"]'] },
  { key: 'gym', label: 'poi.gym', icon: Dumbbell, filters: ['nwr["leisure"="fitness_centre"]'] },
  { key: 'library', label: 'poi.library', icon: Library, filters: ['nwr["amenity"="library"]'] },
];

type Place = { category: string; name: string; lat: number; lon: number; meters: number };

/** Straight-line distance between two points (m). */
function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

/** The nearest place of each category around the room, from OpenStreetMap. */
async function fetchNearby(lat: number, lon: number, signal: AbortSignal): Promise<Place[]> {
  const around = `(around:${NEARBY_RADIUS_M},${lat},${lon})`;
  const body = CATEGORIES.flatMap((c) => c.filters.map((f) => `${f}${around};`)).join('');
  const query = `[out:json][timeout:15];(${body});out center 200;`;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    // Overpass rejects a body without the form content type (406); this type needs no CORS preflight.
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  const json = (await response.json()) as {
    elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
  };
  const nearest = new Map<string, Place>();
  for (const el of json.elements) {
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (pLat === undefined || pLon === undefined) continue;
    const category =
      tags.highway === 'bus_stop' || tags.railway ? 'transport'
      : tags.shop ? 'supermarket'
      : tags.amenity === 'pharmacy' ? 'pharmacy'
      : tags.amenity === 'cafe' || tags.amenity === 'bar' ? 'cafe'
      : tags.leisure === 'fitness_centre' ? 'gym'
      : tags.amenity === 'library' ? 'library'
      : null;
    if (!category) continue;
    const meters = metersBetween(lat, lon, pLat, pLon);
    const current = nearest.get(category);
    if (!current || meters < current.meters) {
      nearest.set(category, { category, name: tags.name ?? '', lat: pLat, lon: pLon, meters });
    }
  }
  return CATEGORIES.map((c) => nearest.get(c.key)).filter((p): p is Place => Boolean(p));
}

/** A round map marker with a Lucide-like glyph drawn in SVG. */
function pinHtml(color: string, svgPath: string, size = 34) {
  return `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 6px 16px rgba(8,80,65,.25)"><svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg></span>`;
}
const HOME_PATH = '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>';
const CAP_PATH = '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>';
const DOT_PATH = '<circle cx="12" cy="12" r="4" fill="currentColor"/>';

/**
 * Listing map: the room (approximate), its university, the straight line
 * between them and the nearest everyday places around the room.
 */
export function ListingMap({ location, university }: { location: ListingLocation; university?: ListingUniversity }) {
  const { t } = useLanguage();
  const format = useFormat();
  const mapRef = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPlaces(null);
    fetchNearby(location.latitude, location.longitude, controller.signal)
      .then(setPlaces)
      .catch(() => {
        if (!controller.signal.aborted) setPlaces([]);
      });
    return () => controller.abort();
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    void import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;
      map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      const home: [number, number] = [location.latitude, location.longitude];
      L.circle(home, { radius: APPROX_RADIUS_M, color: '#0f6e56', weight: 1.5, fillColor: '#9fe1cb', fillOpacity: 0.35 }).addTo(map);
      L.marker(home, { icon: L.divIcon({ html: pinHtml('#085041', HOME_PATH), className: '', iconSize: [34, 34], iconAnchor: [17, 17] }), title: t('listingDetail.mapRoom') }).addTo(map);
      const bounds = L.latLngBounds([home]);
      if (university) {
        const uni: [number, number] = [university.latitude, university.longitude];
        L.polyline([home, uni], { color: '#0f6e56', weight: 3, dashArray: '6 8' }).addTo(map);
        L.marker(uni, { icon: L.divIcon({ html: pinHtml('#ef9f27', CAP_PATH), className: '', iconSize: [34, 34], iconAnchor: [17, 17] }), title: university.name }).addTo(map);
        bounds.extend(uni);
      }
      for (const place of places ?? []) {
        L.marker([place.lat, place.lon], { icon: L.divIcon({ html: pinHtml('#0f6e56', DOT_PATH, 22), className: '', iconSize: [22, 22], iconAnchor: [11, 11] }), title: place.name || t(CATEGORIES.find((c) => c.key === place.category)!.label) }).addTo(map);
        bounds.extend([place.lat, place.lon]);
      }
      map.fitBounds(bounds.pad(0.25), { maxZoom: 16 });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [location.latitude, location.longitude, university, places, t]);

  const km = university ? metersBetween(location.latitude, location.longitude, university.latitude, university.longitude) / 1000 : null;

  return (
    <div>
      {university && km !== null && (
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-sage">
          <GraduationCap size={16} className="shrink-0 text-shutter" aria-hidden />
          <span>
            <span className="font-black text-pine">{format.km(km)} km</span> {t('listingDetail.distanceFrom').replace('{university}', university.name)}
          </span>
        </p>
      )}
      <div ref={mapRef} className="relative z-0 h-[320px] w-full overflow-hidden rounded-2xl border border-pine/10 sm:h-[380px]" role="img" aria-label={t('listingDetail.mapTitle')} />
      <p className="mt-2 text-xs text-sage">{t('listingDetail.mapApprox')}</p>

      <h3 className="mt-6 text-base font-black text-pine">{t('listingDetail.mapNearby')}</h3>
      {places === null ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-[64px] rounded-xl" />
          ))}
        </div>
      ) : places.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {places.map((place) => {
            const category = CATEGORIES.find((c) => c.key === place.category)!;
            const minutes = Math.max(1, Math.round(place.meters / WALK_M_PER_MIN));
            return (
              <li key={place.category} className="flex min-h-[64px] items-center gap-3 rounded-xl border border-pine/10 bg-paper px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-mist text-shutter" aria-hidden>
                  <category.icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-ink">{place.name || t(category.label)}</span>
                  <span className="block text-xs font-bold text-sage">
                    {t(category.label)} · {t('listingDetail.walkMinutes').replace('{n}', String(minutes))}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-sage">{t('listingDetail.mapNoPlaces')}</p>
      )}
    </div>
  );
}

export default ListingMap;
