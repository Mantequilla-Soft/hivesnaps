/**
 * Session Service
 * Manages in-memory session state with decrypted keys and timeout logic
 */

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionData {
    username: string;
    postingKey: string;
    activeKey?: string;
}

class SessionServiceImpl {
    private sessionData: SessionData | null = null;
    private lastUnlockTime: number | null = null;

    /**
     * Record a successful unlock with decrypted keys
     */
    recordUnlock(username: string, postingKey: string, activeKey?: string): void {
        this.sessionData = {
            username,
            postingKey,
            activeKey,
        };
        this.lastUnlockTime = Date.now();
    }

    /**
     * Check if current session is still valid (within timeout)
     */
    isSessionValid(): boolean {
        if (!this.lastUnlockTime || !this.sessionData) {
            return false;
        }

        const now = Date.now();
        const elapsed = now - this.lastUnlockTime;
        return elapsed < SESSION_TIMEOUT_MS;
    }

    /**
     * Clear the current session
     */
    clearSession(): void {
        this.sessionData = null;
        this.lastUnlockTime = null;
    }

    /**
     * Get current session username
     */
    getCurrentUsername(): string | null {
        if (!this.isSessionValid()) {
            this.clearSession();
            return null;
        }
        return this.sessionData?.username || null;
    }

    /**
     * Get current posting key (if session is valid)
     */
    getCurrentPostingKey(): string | null {
        if (!this.isSessionValid()) {
            this.clearSession();
            return null;
        }
        return this.sessionData?.postingKey || null;
    }

    /**
     * Get current active key (if session is valid and key exists)
     */
    getCurrentActiveKey(): string | null {
        if (!this.isSessionValid()) {
            this.clearSession();
            return null;
        }
        return this.sessionData?.activeKey || null;
    }

    /**
     * Check if current session has an active key
     */
    hasActiveKey(): boolean {
        if (!this.isSessionValid()) {
            this.clearSession();
            return false;
        }
        return !!this.sessionData?.activeKey;
    }

    /**
     * Get all session data (if valid)
     */
    getSessionData(): SessionData | null {
        if (!this.isSessionValid()) {
            this.clearSession();
            return null;
        }
        return this.sessionData;
    }

    /**
     * Get time remaining in session (in milliseconds)
     */
    getTimeRemaining(): number {
        if (!this.lastUnlockTime) {
            return 0;
        }
        const now = Date.now();
        const elapsed = now - this.lastUnlockTime;
        const remaining = SESSION_TIMEOUT_MS - elapsed;
        return Math.max(0, remaining);
    }

    /**
     * Check if a session exists (even if expired)
     */
    hasSession(): boolean {
        return this.sessionData !== null;
    }

    /**
     * Refresh the session timeout (e.g., on user activity)
     */
    refreshSession(): void {
        if (this.sessionData) {
            this.lastUnlockTime = Date.now();
        }
    }
}

// Export singleton instance
export const SessionService = new SessionServiceImpl();
