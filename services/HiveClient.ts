/**
 * Centralized Hive RPC Client with Automatic Node Failover
 *
 * dhive's Client does NOT auto-failover between nodes in React Native.
 * This module provides a singleton client that rotates to the next node
 * on connection failure, so callers don't have to handle it themselves.
 *
 * Usage:
 *   import { getHiveClient } from '../services/HiveClient';
 *   const client = getHiveClient();
 *
 * For operations that need failover protection on a per-call basis:
 *   import { hiveCallWithFailover } from '../services/HiveClient';
 *   const result = await hiveCallWithFailover(client => client.database.getAccounts(['username']));
 */

import { Client } from '@hiveio/dhive';

export const HIVE_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
];

let currentNodeIndex = 0;
let clientInstance: Client = new Client(HIVE_NODES[currentNodeIndex]);

/**
 * Returns the shared dhive Client instance.
 * For most read operations this is sufficient — pair with hiveCallWithFailover
 * for automatic retry on node failure.
 */
export function getHiveClient(): Client {
  return clientInstance;
}

/**
 * Rotate to the next RPC node and rebuild the client.
 * Returns the new Client instance.
 */
function rotateNode(): Client {
  currentNodeIndex = (currentNodeIndex + 1) % HIVE_NODES.length;
  console.warn(
    `[HiveClient] Rotating to node ${currentNodeIndex}: ${HIVE_NODES[currentNodeIndex]}`
  );
  clientInstance = new Client(HIVE_NODES[currentNodeIndex]);
  return clientInstance;
}

/**
 * Execute a dhive operation with automatic node failover.
 *
 * Tries each node once. If a call fails with a network/timeout error,
 * it rotates to the next node and retries. Non-network errors (e.g.
 * invalid account name) are thrown immediately.
 *
 * @param operation - async function that receives a Client and returns a result
 * @returns the result of the operation
 *
 * @example
 *   const accounts = await hiveCallWithFailover(c => c.database.getAccounts(['alice']));
 */
export async function hiveCallWithFailover<T>(
  operation: (client: Client) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < HIVE_NODES.length; attempt++) {
    try {
      return await operation(clientInstance);
    } catch (err: unknown) {
      lastError = err;

      if (!isNetworkError(err)) {
        throw err;
      }

      console.warn(
        `[HiveClient] Node ${HIVE_NODES[currentNodeIndex]} failed (attempt ${attempt + 1}/${HIVE_NODES.length}):`,
        err instanceof Error ? err.message : err
      );

      rotateNode();
    }
  }

  throw lastError;
}

/**
 * Determine whether an error is a network/connection issue worth retrying.
 */
function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return true; // unknown errors — retry to be safe

  const msg = err.message.toLowerCase();
  const networkPatterns = [
    'network request failed',
    'timeout',
    'econnrefused',
    'econnreset',
    'enotfound',
    'socket hang up',
    'fetch failed',
    'aborted',
    'etimedout',
    'unable to resolve host',
    'could not connect',
    'http 502',
    'http 503',
    'http 504',
    'http 520',
    'http 521',
    'http 522',
    'http 523',
    'http 524',
  ];

  return networkPatterns.some(pattern => msg.includes(pattern));
}
