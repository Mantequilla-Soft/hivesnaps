/**
 * Hangouts Authentication Service
 * Silently authenticates with the Hive Hangouts server using the stored posting key.
 * Mirrors the signing pattern from AuthService.ts (bs58/elliptic, not dhive PrivateKey.sign).
 */

import { HangoutsApiClient } from '@snapie/hangouts-core';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
// @ts-ignore - bs58 types not needed for runtime
import bs58 from 'bs58';
import { ec as EC } from 'elliptic';
import { accountStorageService } from './AccountStorageService';
import { HANGOUTS_API_URL } from '../app/config/env';

class HangoutsAuthServiceImpl {
  private client: HangoutsApiClient;
  private sessionToken: string | null = null;
  private ec = new EC('secp256k1');

  constructor() {
    this.client = new HangoutsApiClient({ baseUrl: HANGOUTS_API_URL });
  }

  getClient(): HangoutsApiClient {
    return this.client;
  }

  isAuthenticated(): boolean {
    return !!this.sessionToken;
  }

  /**
   * Sign a challenge string with the posting key.
   * The Hangouts server signs just the raw challenge (matching Keychain's requestSignBuffer behavior).
   * Output format: r(32 bytes BE) + s(32 bytes BE) + recovery(1 byte) as hex — matches dhive Signature.
   */
  private signChallenge(challenge: string, postingKey: string): string {
    const decoded = bs58.decode(postingKey);
    const privateKeyBytes = decoded.slice(1, 33);
    const key = this.ec.keyFromPrivate(privateKeyBytes);
    const hashHex = sha256(challenge).toString();
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const sigObj = key.sign(hashBuffer, { canonical: true });
    const recoveryParam = sigObj.recoveryParam ?? 0;
    // dhive Signature.fromString expects: [recoveryParam + 31, r(32), s(32)]
    return Buffer.concat([
      Buffer.from([recoveryParam + 31]),
      sigObj.r.toArrayLike(Buffer, 'be', 32),
      sigObj.s.toArrayLike(Buffer, 'be', 32),
    ]).toString('hex');
  }

  /**
   * Silently authenticate with the Hangouts server.
   * Returns true on success, false if no stored key or auth fails.
   * Non-fatal — hangouts features degrade gracefully on failure.
   */
  async authenticate(): Promise<boolean> {
    try {
      const username = await accountStorageService.getCurrentAccountUsername();
      const postingKey = await accountStorageService.getCurrentPostingKey();
      if (!username || !postingKey) return false;

      const { challenge } = await this.client.requestChallenge(username);
      const signature = this.signChallenge(challenge, postingKey);
      const session = await this.client.verifySignature(username, challenge, signature);
      this.sessionToken = session.token;
      this.client.setSessionToken(session.token);
      return true;
    } catch (error) {
      console.error('[HangoutsAuth] Authentication failed:', error);
      return false;
    }
  }

  clearSession(): void {
    this.sessionToken = null;
    this.client.clearSessionToken();
  }
}

export const hangoutsAuthService = new HangoutsAuthServiceImpl();
