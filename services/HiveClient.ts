/**
 * Centralized Hive blockchain client with manual node failover.
 *
 * dhive's built-in failover does not work reliably on React Native —
 * requests to a dead node hang indefinitely instead of rotating.
 * This wrapper tries each node with a timeout and rotates on failure.
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
  console.log(`[HiveClient] Rotated to node: ${HIVE_NODES[currentNodeIndex]}`);
}

/**
 * A proxy that always delegates to the current dhive Client.
 * This means `const client = getClient()` at module level stays valid
 * even after node rotation, because property access is forwarded
 * to whatever `currentClient` points to at call time.
 */
const clientProxy = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = (currentClient as any)[prop];
    if (typeof value === 'function') {
      return value.bind(currentClient);
    }
    return value;
  },
});

/**
 * Returns a proxy to the current dhive Client instance.
 * Safe to cache at module level — always delegates to the active node.
 */
export function getClient(): Client {
  return clientProxy;
}

/**
 * Returns the currently active node URL.
 */
export function getCurrentNode(): string {
  return HIVE_NODES[currentNodeIndex];
}

/**
 * Wraps a dhive call with a timeout and automatic node rotation.
 *
 * Usage:
 *   const accounts = await hiveCall(() => getClient().database.getAccounts([name]));
 *
 * Tries each node once. If all nodes fail, throws the last error.
 */
export async function hiveCall<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < HIVE_NODES.length; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Hive node timeout after ${NODE_TIMEOUT_MS}ms: ${getCurrentNode()}`)), NODE_TIMEOUT_MS)
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[HiveClient] Node ${getCurrentNode()} failed (attempt ${attempt + 1}/${HIVE_NODES.length}):`, err);
      rotateNode();
    }
  }

  throw lastError;
}
