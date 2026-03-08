/**
 * Centralized Hive blockchain client with automatic node failover.
 *
 * dhive's built-in failover does not work reliably on React Native —
 * requests to a dead node hang indefinitely instead of rotating.
 *
 * On the first Hive call (and lazily every 10 minutes thereafter), this
 * module fetches the live node list from PeakD's beacon API, filters to
 * healthy nodes that support broadcast, and sorts by score. A hardcoded
 * fallback list is used if the beacon is unreachable.
 *
 * Every method call on the returned client proxy is automatically wrapped
 * with a timeout and node rotation, so callers can use
 * `getClient().database.getAccounts(...)` normally and get failover for free.
 */

import { Client } from '@hiveio/dhive';

// --- Beacon API types ---

interface BeaconNode {
  name: string;
  endpoint: string;
  score: number;
  fail: number;
  features: string[];
}

// --- Configuration ---

const BEACON_URL = 'https://beacon.peakd.com/api/nodes';
const BEACON_TIMEOUT_MS = 5000;
const NODE_TIMEOUT_MS = 8000;
const BEACON_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_NODE_SCORE = 50;

/** Hardcoded fallback used when the beacon API is unreachable. */
const FALLBACK_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
  'https://techcoderx.com',
  'https://rpc.mahdiyari.info',
  'https://api.c0ff33a.uk',
];

// --- State ---

let nodeList: string[] = [...FALLBACK_NODES];
let currentNodeIndex = 0;
let currentClient = new Client([nodeList[currentNodeIndex]]);
let lastRefreshedAt = 0;

// --- Beacon fetching ---

/**
 * Fetches the live node list from PeakD's beacon API.
 * Filters to nodes with score >= MIN_NODE_SCORE and broadcast support,
 * sorted by score descending (best nodes first).
 * Falls back to the hardcoded list if the beacon is unreachable.
 */
async function fetchBeaconNodes(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BEACON_TIMEOUT_MS);

    const response = await fetch(BEACON_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Beacon API returned ${response.status}`);
    }

    const nodes: BeaconNode[] = await response.json();

    const healthy = nodes
      .filter(n => n.score >= MIN_NODE_SCORE && n.features.includes('broadcast'))
      .sort((a, b) => b.score - a.score)
      .map(n => n.endpoint);

    if (healthy.length === 0) {
      console.warn('[HiveClient] Beacon returned no healthy nodes, using fallback list');
      return FALLBACK_NODES;
    }

    if (__DEV__) {
      console.log(`[HiveClient] Beacon returned ${healthy.length} healthy nodes:`, healthy);
    }

    return healthy;
  } catch (err) {
    console.warn('[HiveClient] Failed to fetch beacon nodes, using fallback list:', err);
    return FALLBACK_NODES;
  }
}

/**
 * Refreshes the node list from the beacon API.
 * Preserves the current node if it's still in the new list.
 */
async function refreshNodeList(): Promise<void> {
  const currentEndpoint = nodeList[currentNodeIndex];
  const newList = await fetchBeaconNodes();

  nodeList = newList;

  // Try to keep using the same node if it's still healthy
  const idx = newList.indexOf(currentEndpoint);
  if (idx !== -1) {
    currentNodeIndex = idx;
  } else {
    currentNodeIndex = 0;
    currentClient = new Client([nodeList[0]]);
    if (__DEV__) {
      console.log(`[HiveClient] Current node dropped from list, switched to ${nodeList[0]}`);
    }
  }
}

/**
 * Lazily refreshes the beacon node list if it's stale.
 * Called automatically before each hiveCall — no timers or eager fetches.
 */
let refreshPromise: Promise<void> | null = null;

async function maybeRefreshNodeList(): Promise<void> {
  const now = Date.now();
  if (now - lastRefreshedAt < BEACON_REFRESH_INTERVAL_MS) return;

  // Coalesce concurrent refresh attempts
  if (!refreshPromise) {
    refreshPromise = refreshNodeList()
      .then(() => { lastRefreshedAt = Date.now(); })
      .catch(() => { /* keep using current list */ })
      .finally(() => { refreshPromise = null; });
  }

  await refreshPromise;
}

// --- Node rotation ---

function rotateNode(): void {
  currentNodeIndex = (currentNodeIndex + 1) % nodeList.length;
  currentClient = new Client([nodeList[currentNodeIndex]]);
  if (__DEV__) {
    console.log(`[HiveClient] Rotated to node: ${nodeList[currentNodeIndex]}`);
  }
}

/**
 * Returns the currently active node URL.
 */
export function getCurrentNode(): string {
  return nodeList[currentNodeIndex];
}

// --- Failover call wrapper ---

/**
 * Executes a single call with a timeout. No retry — used for broadcast
 * operations where retrying could submit duplicate transactions.
 */
async function hiveCallOnce<T>(fn: () => Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const result = await Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Hive node timeout after ${NODE_TIMEOUT_MS}ms: ${getCurrentNode()}`)),
        NODE_TIMEOUT_MS,
      );
    }),
  ]);

  clearTimeout(timeoutId);
  return result;
}

/**
 * Wraps a dhive call with a timeout and automatic node rotation.
 * Tries each node once. If all nodes fail, throws the last error.
 * Only used for read operations — broadcast uses hiveCallOnce.
 */
export async function hiveCall<T>(fn: () => Promise<T>): Promise<T> {
  await maybeRefreshNodeList();

  let lastError: unknown;
  const maxAttempts = nodeList.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await hiveCallOnce(fn);
    } catch (err) {
      lastError = err;
      console.warn(
        `[HiveClient] Node ${getCurrentNode()} failed (attempt ${attempt + 1}/${maxAttempts}):`,
        err,
      );
      rotateNode();
    }
  }

  throw lastError;
}

// --- Failover proxy ---

/**
 * Creates a recursive proxy that wraps every function call with failover.
 * Sub-objects like `client.database` and `client.broadcast` are themselves
 * proxied so that `client.database.getAccounts(...)` is automatically
 * wrapped with timeout + retry.
 *
 * Broadcast operations are NOT retried across nodes to prevent duplicate
 * transactions — they get a single attempt with a timeout. If a broadcast
 * times out, the caller receives the error and can decide whether to retry.
 */
function createFailoverProxy(getTarget: () => any, isBroadcast = false): Client {
  const subProxies = new Map<string | symbol, any>();
  const wrapper = isBroadcast ? hiveCallOnce : hiveCall;

  return new Proxy({} as Client, {
    get(_target, prop) {
      const value = getTarget()[prop];

      if (typeof value === 'function') {
        return (...args: any[]) =>
          wrapper(() => value.apply(getTarget(), args));
      }

      // For sub-objects (database, broadcast, etc.), return a stable
      // recursive proxy so property access chains work correctly.
      if (value != null && typeof value === 'object') {
        if (!subProxies.has(prop)) {
          const childIsBroadcast = isBroadcast || prop === 'broadcast';
          subProxies.set(prop, createFailoverProxy(() => getTarget()[prop], childIsBroadcast));
        }
        return subProxies.get(prop);
      }

      return value;
    },
  });
}

const clientProxy = createFailoverProxy(() => currentClient);

/**
 * Returns a proxy to the current dhive Client instance.
 * Safe to cache at module level — always delegates to the active node.
 * All async method calls are automatically wrapped with timeout + failover.
 */
export function getClient(): Client {
  return clientProxy;
}
