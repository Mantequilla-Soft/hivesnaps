// Detects a broadcast failing because the stored key no longer matches the
// account's on-chain authority — the case where someone changed their
// posting/active key with another app (Keychain, PeakD, hive.blog...) but
// HiveSnaps is still signing with the old one. The old key is still
// well-formed (PrivateKey.fromString succeeds, it signs fine locally), so
// this can only be detected once hived's verify_authority rejects the
// signature — there's no client-side way to know sooner.
//
// hived doesn't expose a stable structured error code for this across
// dhive versions/node implementations, so this is a best-effort match
// against known wording from hived's verify_authority failures. If you hit
// a real case that isn't caught here, add the new phrasing rather than
// loosening this to something broader — a false positive means logging
// someone out for an unrelated transient error.
const AUTHORITY_MISMATCH_PATTERNS = [
  /missing (required )?(posting|active|owner) authority/i,
  /tx_missing_(posting|active|owner)_auth/i,
  /signature is not valid/i,
  /irrelevant signature/i,
];

export function isAuthorityMismatchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message) return false;
  return AUTHORITY_MISMATCH_PATTERNS.some(pattern => pattern.test(message));
}

// RN has no window.dispatchEvent/CustomEvent — same module-level pub/sub
// stand-in as utils/pointsEvents.ts. services/HiveClient.ts (a plain
// module, not a hook) emits this the instant any broadcast anywhere in the
// app hits an authority mismatch; app/_layout.tsx's always-mounted root
// listens and drives the actual logout + navigation, since only a
// component has access to useAuth()/useRouter().
// `account` is the username the failing broadcast was signed for (when
// known) — lets a listener ignore a mismatch for an account the user has
// since switched away from, instead of logging out whatever account is
// current by the time the rejection arrives.
type Listener = (account: string | null) => void;

const listeners = new Set<Listener>();

export function onAuthorityMismatch(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitAuthorityMismatch(account: string | null = null): void {
  listeners.forEach(cb => cb(account));
}
