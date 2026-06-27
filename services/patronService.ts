const PATRONS_URL = 'https://snapie.io/api/patrons';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export type PatronTier = 'snap-master' | 'snapian' | 'snaperino';

interface Patron {
  account: string;
  tier: PatronTier;
  via?: string;
}

let cachedMap: Map<string, PatronTier> | null = null;
let cacheExpiry = 0;
let inflight: Promise<Map<string, PatronTier>> | null = null;

async function fetchPatrons(): Promise<Map<string, PatronTier>> {
  const res = await fetch(PATRONS_URL);
  if (!res.ok) throw new Error(`Patrons fetch failed: ${res.status}`);
  const data: { patrons: Patron[] } = await res.json();
  const map = new Map<string, PatronTier>();
  for (const p of data.patrons) {
    map.set(p.account, p.tier);
  }
  return map;
}

function loadPatrons(): Promise<Map<string, PatronTier>> {
  if (cachedMap && Date.now() < cacheExpiry) return Promise.resolve(cachedMap);
  if (inflight) return inflight;

  inflight = fetchPatrons()
    .then(map => {
      cachedMap = map;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      inflight = null;
      return map;
    })
    .catch(() => {
      inflight = null;
      return cachedMap ?? new Map<string, PatronTier>();
    });

  return inflight;
}

export async function getPatronTier(account: string): Promise<PatronTier | null> {
  const map = await loadPatrons();
  return map.get(account) ?? null;
}
