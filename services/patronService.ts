const PATRONS_URL = 'https://snapie.io/api/patrons';
const CACHE_TTL_MS = 60 * 60 * 1000;       // 1 hour on success
const ERROR_RETRY_TTL_MS = 5 * 60 * 1000;  // 5 min backoff on failure
const FETCH_TIMEOUT_MS = 10_000;

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PATRONS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Patrons fetch failed: ${res.status}`);
    const data: { patrons: Patron[] } = await res.json();
    const map = new Map<string, PatronTier>();
    for (const p of data.patrons) {
      map.set(p.account, p.tier);
    }
    return map;
  } finally {
    clearTimeout(timer);
  }
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
      // Back off 5 min so we don't hammer the endpoint during an outage.
      cachedMap ??= new Map<string, PatronTier>();
      cacheExpiry = Date.now() + ERROR_RETRY_TTL_MS;
      return cachedMap;
    });

  return inflight;
}

export async function getPatronTier(account: string): Promise<PatronTier | null> {
  const map = await loadPatrons();
  return map.get(account) ?? null;
}
