/**
 * JWT Authentication Service
 * Handles challenge-response authentication flow with the API server
 */

import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
// Import libraries for the secret sauce signing method
// @ts-ignore - bs58 types not needed for runtime
import bs58 from 'bs58';
import { ec as EC } from 'elliptic';
import { makeRequest, NetworkTarget } from './networking';
import { BASE_API_URL } from '../app/config/env';

// Challenge response from server
export interface ChallengeResponse {
  challenge: string;
  timestamp: number;
  message: string;
  instructions: string;
}

// JWT verification request
export interface VerifyRequest {
  username: string;
  challenge: string;
  timestamp: number;
  signature: string;
}

// JWT token response from server
export interface TokenResponse {
  message: string;
  token: string;
  refreshToken: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

class AuthServiceImpl {
  private currentToken: string | null = null;
  private currentRefreshToken: string | null = null;
  /** Sign-ins in flight, per lowercased username (see authenticate). */
  private inFlight = new Map<string, Promise<AuthResult>>();
  private readonly DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  // Create elliptic curve instance (secp256k1) for SECRET SAUCE signing
  private ec = new EC('secp256k1');

  /**
   * Get current JWT token
   */
  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    return this.currentRefreshToken;
  }

  /**
   * Set JWT token
   */
  setToken(token: string | null): void {
    this.currentToken = token;
    if (this.DEBUG) {
      console.log(`[AuthService] Token ${token ? 'set' : 'cleared'}`);
    }
  }

  /**
   * Set refresh token
   */
  setRefreshToken(refreshToken: string | null): void {
    this.currentRefreshToken = refreshToken;
    if (this.DEBUG) {
      console.log(`[AuthService] Refresh token ${refreshToken ? 'set' : 'cleared'}`);
    }
  }

  /**
   * Clear JWT token
   */
  clearToken(): void {
    this.currentToken = null;
    if (this.DEBUG) {
      console.log('[AuthService] Token cleared');
    }
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return !!this.currentToken;
  }

  /**
   * Request challenge from server
   */
  private async requestChallenge(username: string): Promise<ChallengeResponse> {
    const target: NetworkTarget = {
      path: '/auth/challenge',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: { username },
      timeoutMs: 10000,
    };

    try {
      const { body, status } = await makeRequest(target);
      
      if (status !== 200) {
        throw new Error(`Challenge request failed with status ${status}`);
      }

      if (!body || !body.challenge || !body.timestamp) {
        throw new Error('Invalid challenge response format');
      }

      if (this.DEBUG) {
        console.log(`[AuthService] Challenge received for ${username}`);
      }

      return body as ChallengeResponse;
    } catch (error) {
      if (this.DEBUG) {
        console.error('[AuthService] Challenge request failed:', error);
      }
      throw new Error(`Failed to request challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign challenge string with posting key - SECRET SAUCE METHOD
   * This is the exact implementation from your brother that works!
   */
  private signChallenge(username: string, challenge: string, timestamp: number, postingKey: string): string {
    try {
      if (this.DEBUG) {
        console.log('[AuthService] 🛠️ Using SECRET SAUCE signing implementation (elliptic)');
      }

      // Validate WIF format
      if (!postingKey.startsWith('5')) {
        throw new Error('Invalid WIF key format');
      }

      // Manual WIF decoding (SECRET SAUCE step 1)
      const decoded = bs58.decode(postingKey);
      const privateKeyBytes = decoded.slice(1, 33); // skip prefix (0x80) and checksum
      const key = this.ec.keyFromPrivate(privateKeyBytes);

      // Construct message (SECRET SAUCE step 2)
      const message = `${username}:${challenge}:${timestamp}`;

      if (this.DEBUG) {
        console.log('[AuthService] 📝 Message:', message);
        console.log('[AuthService] 📏 Message length:', message.length);
      }

      // Hash the message STRING (not buffer) - SECRET SAUCE step 3
      const hashHex = sha256(message).toString();
      const hashBuffer = Buffer.from(hashHex, 'hex');

      if (this.DEBUG) {
        console.log('[AuthService] 📝 Message hash:', hashHex);
        console.log('[AuthService] 📏 Hash length:', hashHex.length);
      }

      // Sign with elliptic (canonical) - SECRET SAUCE step 4
      const sigObj = key.sign(hashBuffer, { canonical: true });
      
      // Create custom signature format - SECRET SAUCE step 5
      const recoveryParam = sigObj.recoveryParam ?? 0; // Handle potential null
      const signature = Buffer.concat([
        sigObj.r.toArrayLike(Buffer, 'be', 32),  // r component (32 bytes, big endian)
        sigObj.s.toArrayLike(Buffer, 'be', 32),  // s component (32 bytes, big endian)
        Buffer.from([recoveryParam])             // recovery parameter (1 byte)
      ]).toString('hex');

      // Get public key info for debugging
      const derivedPublicKey = key.getPublic('hex');
      const derivedPublicKeyCompressed = key.getPublic(true, 'hex');

      if (this.DEBUG) {
        console.log('[AuthService] 🔑 Public key (uncompressed):', derivedPublicKey);
        console.log('[AuthService] 🔑 Public key (compressed):', derivedPublicKeyCompressed);
        console.log('[AuthService] 🔏 Signature (hex):', signature);
        console.log('[AuthService] 📏 Signature length:', signature.length);
        console.log('[AuthService] 🔑 Recovery param:', recoveryParam);
        
        if (recoveryParam !== 0 && recoveryParam !== 1) {
          console.warn('[AuthService] ⚠️ Recovery param is not 0 or 1:', recoveryParam);
        }
      }

      return signature;
    } catch (error) {
      if (this.DEBUG) {
        console.error('[AuthService] Signing failed:', error);
      }
      throw new Error(`Failed to sign challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify signature and get JWT token
   */
  private async verifySignature(verifyRequest: VerifyRequest): Promise<TokenResponse> {
    if (this.DEBUG) {
      console.log(`[AuthService] Sending verification request:`, {
        username: verifyRequest.username,
        challenge: verifyRequest.challenge,
        timestamp: verifyRequest.timestamp,
        signature: verifyRequest.signature,
        signatureLength: verifyRequest.signature.length
      });
    }

    const target: NetworkTarget = {
      path: '/auth/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: verifyRequest,
      timeoutMs: 10000,
    };

    try {
      const { body, status } = await makeRequest(target);
      
      if (status !== 200) {
        if (this.DEBUG) {
          console.error(`[AuthService] Verification failed with status ${status}:`, body);
        }
        throw new Error(`Verification failed with status ${status}: ${JSON.stringify(body)}`);
      }

      if (!body || !body.token) {
        throw new Error('Invalid verification response format');
      }

      if (this.DEBUG) {
        console.log(`[AuthService] JWT token received for ${verifyRequest.username}`);
      }

      return body as TokenResponse;
    } catch (error) {
      if (this.DEBUG) {
        console.error('[AuthService] Verification failed:', error);
      }
      throw new Error(`Failed to verify signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh JWT token using refresh token
   */
  async refreshTokenWithRefreshToken(): Promise<string> {
    if (!this.currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    if (this.DEBUG) {
      console.log('[AuthService] Refreshing token...');
    }

    const target: NetworkTarget = {
      path: '/auth/refresh',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: { refreshToken: this.currentRefreshToken },
      timeoutMs: 10000,
    };

    try {
      const { body, status } = await makeRequest(target);
      
      if (status !== 200) {
        if (this.DEBUG) {
          console.error(`[AuthService] Token refresh failed with status ${status}:`, body);
        }
        throw new Error(`Token refresh failed with status ${status}: ${JSON.stringify(body)}`);
      }

      if (!body || !body.token) {
        throw new Error('Invalid refresh response format');
      }

      // Update the current token
      this.setToken(body.token);

      if (this.DEBUG) {
        console.log('[AuthService] Token refreshed successfully');
      }

      return body.token;
    } catch (error) {
      if (this.DEBUG) {
        console.error('[AuthService] Token refresh failed:', error);
      }
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete authentication flow: challenge -> sign -> verify -> get JWT.
   *
   * Single-flight per user: the backend keeps only the latest challenge for
   * a user, so two overlapping sign-ins make the first fail with "Invalid
   * challenge" (#262). A call while one is already running for the same
   * user gets that same result instead of requesting a new challenge.
   */
  authenticate(username: string, postingKey: string): Promise<AuthResult> {
    const key = username.toLowerCase();
    const running = this.inFlight.get(key);
    if (running) {
      if (this.DEBUG) {
        console.log(`[AuthService] Sign-in already in progress for ${username}, reusing it`);
      }
      return running;
    }
    const attempt = this.runAuthentication(username, postingKey).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, attempt);
    return attempt;
  }

  private async runAuthentication(username: string, postingKey: string): Promise<AuthResult> {
    try {
      if (this.DEBUG) {
        console.log(`[AuthService] Starting authentication for ${username}`);
      }

      // Step 1: Request challenge
      const challengeResponse = await this.requestChallenge(username);

      // Step 2: Sign challenge
      const signature = this.signChallenge(
        username,
        challengeResponse.challenge,
        challengeResponse.timestamp,
        postingKey
      );

      // Step 3: Verify signature and get JWT
      const tokenResponse = await this.verifySignature({
        username,
        challenge: challengeResponse.challenge,
        timestamp: challengeResponse.timestamp,
        signature,
      });

      // Step 4: Store tokens
      this.setToken(tokenResponse.token);
      this.setRefreshToken(tokenResponse.refreshToken);

      if (this.DEBUG) {
        console.log(`[AuthService] Authentication successful for ${username}`);
      }

      return {
        success: true,
        token: tokenResponse.token,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      
      if (this.DEBUG) {
        console.error(`[AuthService] Authentication failed for ${username}:`, errorMessage);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Refresh JWT token using stored credentials
   * Used for seamless token renewal when API calls fail with 401
   */
  async refreshToken(username: string, postingKey: string): Promise<boolean> {
    try {
      if (this.DEBUG) {
        console.log(`[AuthService] Refreshing token for ${username}`);
      }

      const result = await this.authenticate(username, postingKey);
      
      if (result.success) {
        if (this.DEBUG) {
          console.log(`[AuthService] Token refresh successful for ${username}`);
        }
        return true;
      } else {
        if (this.DEBUG) {
          console.error(`[AuthService] Token refresh failed for ${username}:`, result.error);
        }
        return false;
      }
    } catch (error) {
      if (this.DEBUG) {
        console.error(`[AuthService] Token refresh error for ${username}:`, error);
      }
      return false;
    }
  }

  /**
   * Logout: clear tokens and refresh token
   */
  logout(): void {
    this.setToken(null);
    this.setRefreshToken(null);
    if (this.DEBUG) {
      console.log('[AuthService] User logged out, tokens cleared');
    }
  }
}

// Export singleton instance
export const authService = new AuthServiceImpl();
