// Resolves any customer location input (Telegram pin, Google/Yandex map link, plain text)
// into exact coordinates + nearest named place (OpenStreetMap Nominatim).
export interface GeoLocation { lat: number; lng: number; name: string; mapUrl: string; source: 'telegram' | 'link' | 'text' }

const UA = { 'User-Agent': 'gunaydin-bot/1.0', 'Accept-Language': 'uz,ru,en' };
const valid = (lat: number, lng: number) => isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const mapUrl = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`;

export function coordsFromText(s: string): { lat: number; lng: number } | null {
  const d = decodeURIComponent(s);
  const pats = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,            // google place data
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,                 // google @lat,lng
    /[?&](?:q|query|ll|destination|daddr|center)=(-?\d+\.\d+)[, ]+(-?\d+\.\d+)/,
    /(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})/, // plain "41.31, 69.27"
  ];
  for (const p of pats) { const m = d.match(p); if (m) { const lat = +m[1], lng = +m[2]; if (valid(lat, lng)) return { lat, lng }; } }
  // Yandex: ll=lng,lat / pt=lng,lat
  const y = d.match(/[?&](?:ll|pt)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (y && /yandex/i.test(d) && valid(+y[2], +y[1])) return { lat: +y[2], lng: +y[1] };
  return null;
}

async function expandUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: UA });
    const html = r.headers.get('content-type')?.includes('text') ? await r.text() : '';
    return r.url + ' ' + html.slice(0, 200000);
  } catch { return url; }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: UA });
    const j: any = await r.json();
    const a = j.address || {};
    const place = j.name || a.amenity || a.shop || a.building || a.house_name;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const area = a.neighbourhood || a.suburb || a.quarter || a.residential;
    const city = a.city || a.town || a.village || a.county || a.state;
    const parts = [place, street, area, city].filter((v, i, arr) => v && arr.indexOf(v) === i);
    return parts.join(', ') || j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

async function forwardGeocode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=uz&q=${encodeURIComponent(q)}`, { headers: UA });
    const j: any[] = await r.json();
    if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon };
  } catch { /* ignore */ }
  return null;
}

/** Resolve plain text or link. Returns null only if nothing could be found. */
export async function resolveLocationText(text: string): Promise<GeoLocation | null> {
  let c = coordsFromText(text);
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!c && url) c = coordsFromText(await expandUrl(url));
  if (c) return { ...c, name: await reverseGeocode(c.lat, c.lng), mapUrl: mapUrl(c.lat, c.lng), source: url ? 'link' : 'text' };
  if (url) return null;
  const f = await forwardGeocode(text);
  if (f) return { ...f, name: await reverseGeocode(f.lat, f.lng), mapUrl: mapUrl(f.lat, f.lng), source: 'text' };
  return null;
}

export async function resolveTelegramLocation(lat: number, lng: number): Promise<GeoLocation> {
  return { lat, lng, name: await reverseGeocode(lat, lng), mapUrl: mapUrl(lat, lng), source: 'telegram' };
}
