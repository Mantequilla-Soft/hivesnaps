/**
 * Snapie Points Authentication Service
 * Silently authenticates with snapie.io using the locally stored posting key,
 * to obtain the Bearer JWT the points award endpoint requires.
 * Signing is copied verbatim from HangoutsAuthService.ts (bs58/elliptic, not
 * dhive PrivateKey.sign) — snapie.io's verifyHiveSignature (lib/chat/auth.ts)
 * already accepts this exact wire format.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
import bs58 from 'bs58';
import { ec as EC } from 'elliptic';
import { accountStorageService } from './AccountStorageService';

const SNAPIE_API_URL = 'https://snapie.io';
const TOKEN_STORAGE_KEY = 'snapie-points-token';
// Mirrors snapie.io's own client-side buffer (lib/points/client.ts) so a
// token that's about to expire gets refreshed rather than used right up to
// the wire and rejected mid-request.
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

const ec = new EC('secp256k1');

/**
 * Sign a challenge string with the posting key.
 * snapie.io's chat auth verifies just the raw challenge (matching Keychain's
 * requestSignBuffer behavior). Output format: [recoveryParam+31, r(32), s(32)]
 * as hex — dhive Signature.fromString()/fromBuffer() wire format.
 */
function signChallenge(challenge: string, postingKey: string): string {
  const decoded = bs58.decode(postingKey);
  const privateKeyBytes = decoded.slice(1, 33);
  const key = ec.keyFromPrivate(privateKeyBytes);
  const hashHex = sha256(challenge).toString();
  const hashBuffer = Buffer.from(hashHex, 'hex');
  const sigObj = key.sign(hashBuffer, { canonical: true });
  const recoveryParam = sigObj.recoveryParam ?? 0;
  return Buffer.concat([
    Buffer.from([recoveryParam + 31]),
    sigObj.r.toArrayLike(Buffer, 'be', 32),
    sigObj.s.toArrayLike(Buffer, 'be', 32),
  ]).toString('hex');
}

/** Reads a JWT's `exp` claim without verifying the signature — a client-side
 *  freshness hint only. Returns null if unreadable, in which case the caller
 *  treats the token as still usable (the server is the real check). */
function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Deduplicates concurrent mint attempts, keyed by username so a mid-flight
// account switch doesn't hand the new user a token minted for the old one.
let tokenMintInFlight: { username: string; promise: Promise<string | null> } | null = null;

async function mintToken(username: string, postingKey: string): Promise<string | null> {
  const challengeRes = await fetch(`${SNAPIE_API_URL}/api/chat/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!challengeRes.ok) return null;
  const { challenge } = (await challengeRes.json()) as { challenge?: string };
  if (!challenge) return null;

  const signature = signChallenge(challenge, postingKey);

  const verifyRes = await fetch(`${SNAPIE_API_URL}/api/chat/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, challenge, signature }),
  });
  if (!verifyRes.ok) return null;
  const { token } = (await verifyRes.json()) as { token?: string };
  return token ?? null;
}

/** Returns a usable Bearer token for the points API — a cached one from
 *  AsyncStorage if it's still fresh, otherwise silently mints a new one via
 *  the challenge/sign/verify flow. Never throws; returns null on any failure
 *  (no stored account, signing failure, network error) so callers can treat
 *  "no token" the same as "points temporarily unavailable". */
export async function getPointsAuthToken(): Promise<string | null> {
  const username = await accountStorageService.getCurrentAccountUsername();
  if (!username) return null;

  try {
    const cached = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (cached) {
      const exp = jwtExpiryMs(cached);
      if (exp === null || exp > Date.now() + TOKEN_EXPIRY_BUFFER_MS) return cached;
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — fall through to minting a fresh token.
  }

  if (tokenMintInFlight?.username === username) return tokenMintInFlight.promise;

  const promise = (async () => {
    try {
      const postingKey = await accountStorageService.getCurrentPostingKey();
      if (!postingKey) return null;

      const token = await mintToken(username, postingKey);
      if (token) {
        try {
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          // Non-fatal — the token still works for this session, just won't persist.
        }
      }
      return token;
    } catch (error) {
      // Log message only — never log the full error object (may contain key material in stack traces)
      console.warn('[pointsAuthService] Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    } finally {
      tokenMintInFlight = null;
    }
  })();

  tokenMintInFlight = { username, promise };
  return promise;
}

/** Clears the cached token — call on logout/account switch so a stale JWT
 *  never leaks across accounts. */
export async function clearPointsAuthToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
