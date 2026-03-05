/**
 * Centralized Hive blockchain client with automatic node failover.
 *
 * dhive's built-in failover does not work reliably on React Native —
 * requests to a dead node hang indefinitely instead of rotating.
 *
 * This module returns a proxy Client whose every method call is
 * automatically wrapped with a timeout and node rotation, so callers
 * can use `getClient().database.getAccounts(...)` normally and get
 * failover for free.
 */

import { Client } from '@hiveio/dhive';

const HIVE_NODES = [
  'https://api.deathwing.me',
  'https://api.openhive.network',
  'https://techcoderx.com',
  'https://api.c0ff33a.uk',
  'https://rpc.mahdiyari.info',
];

const NODE_TIMEOUT_MS = 8000;

let currentNodeIndex = 0;
let currentClient = new Client([HIVE_NODES[currentNodeIndex]]);

function rotateNode(): void {
  currentNodeIndex = (currentNodeIndex + 1) % HIVE_NODES.length;
  currentClient = new Client([HIVE_NODES[currentNodeIndex]]);
  if (__DEV__) {
    console.log(`[HiveClient] Rotated to node: ${HIVE_NODES[currentNodeIndex]}`);
  }
}

/**
 * Returns the currently active node URL.
 */
export function getCurrentNode(): string {
  return HIVE_NODES[currentNodeIndex];
}

/**
 * Wraps a dhive call with a timeout and automatic node rotation.
 * Tries each node once. If all nodes fail, throws the last error.
 */
export async function hiveCall<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < HIVE_NODES.length; attempt++) {
    try {
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
    } catch (err) {
      lastError = err;
      console.warn(
        `[HiveClient] Node ${getCurrentNode()} failed (attempt ${attempt + 1}/${HIVE_NODES.length}):`,
        err,
      );
      rotateNode();
    }
  }

  throw lastError;
}

/**
 * Creates a recursive proxy that wraps every function call with `hiveCall`.
 * Sub-objects like `client.database` and `client.broadcast` are themselves
 * proxied so that `client.database.getAccounts(...)` is automatically
 * wrapped with timeout + retry.
 */
function createFailoverProxy(getTarget: () => any): Client {
  const subProxies = new Map<string | symbol, any>();

  return new Proxy({} as Client, {
    get(_target, prop) {
      const value = getTarget()[prop];

      if (typeof value === 'function') {
        // Wrap every call with hiveCall so failover kicks in automatically.
        // hiveCall only adds overhead for async (Promise-returning) calls;
        // for the rare sync helper it still works correctly.
        return (...args: any[]) =>
          hiveCall(() => value.apply(getTarget(), args));
      }

      // For sub-objects (database, broadcast, etc.), return a stable
      // recursive proxy so property access chains work correctly.
      if (value != null && typeof value === 'object') {
        if (!subProxies.has(prop)) {
          subProxies.set(prop, createFailoverProxy(() => getTarget()[prop]));
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
