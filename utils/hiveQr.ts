/**
 * Encodes/decodes a Hive transfer as a QR-scannable URI. Ported verbatim
 * from snapie-io's lib/hive/qr-utils.ts (same `hive://sign/op/<base64url>`
 * scheme) so a HiveSnaps "Request Payment" QR and a snapie-io scanner (or
 * vice versa) can read each other's codes.
 *
 * Uses the global `btoa`/`atob` (available in React Native since 0.74 —
 * no polyfill needed on the RN 0.81 this app runs).
 */

export interface HiveTransferQRData {
  to: string;
  amount: string; // e.g. "1.234 HIVE" or "0.500 HBD"
  memo: string;
}

export function encodeHiveTransferQR(to: string, amount: string, memo: string): string {
  const op = JSON.stringify(['transfer', { to, amount, memo }]);
  const bytes = new TextEncoder().encode(op);
  let binary = '';
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `hive://sign/op/${b64}`;
}

export function decodeHiveTransferQR(raw: string): HiveTransferQRData | null {
  try {
    const PREFIX = 'hive://sign/op/';
    if (!raw.startsWith(PREFIX)) return null;

    const b64url = raw.slice(PREFIX.length);
    const pad = '=='.slice(0, (4 - (b64url.length % 4)) % 4);
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const op = JSON.parse(new TextDecoder().decode(bytes));

    if (!Array.isArray(op) || op[0] !== 'transfer') return null;
    const { to, amount, memo } = op[1] as Record<string, string>;
    if (!to || !amount) return null;

    return { to, amount, memo: memo ?? '' };
  } catch {
    return null;
  }
}

/** Parse currency from an amount string like "1.234 HIVE" -> "HIVE" */
export function currencyFromAmount(amount: string): 'HIVE' | 'HBD' {
  return amount.toUpperCase().includes('HBD') ? 'HBD' : 'HIVE';
}

/** Parse numeric value from an amount string like "1.234 HIVE" -> 1.234 */
export function valueFromAmount(amount: string): number {
  return parseFloat(amount) || 0;
}
