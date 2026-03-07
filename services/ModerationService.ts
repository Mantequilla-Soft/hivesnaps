import { hiveCallWithFailover } from './HiveClient';
import { MOD_ALLOWLIST, MOD_TTL_MS } from '../config/moderation';

export interface ModerationVerdict {
  isBlocked: boolean;
  checkedAt: number;
  by?: string[]; // moderators who voted negatively
}

export interface ActiveVote {
  voter: string;
  percent?: number; // hundredths of a percent (Hive style)
  rshares?: number;
}

const allowlist = new Set(MOD_ALLOWLIST.map(u => u.toLowerCase()));

type Key = string; // `${author}/${permlink}`

class ModerationServiceImpl {
  private cache = new Map<Key, ModerationVerdict>();
  private inFlight = new Map<Key, Promise<ModerationVerdict>>();

  private key(author: string, permlink: string): Key {
    return `${author.toLowerCase()}/${permlink}`;
  }

  primeAllowlist(users: string[]) {
    allowlist.clear();
    users.forEach(u => allowlist.add(u.toLowerCase()));
  }

  getCached(author: string, permlink: string): ModerationVerdict | undefined {
    const k = this.key(author, permlink);
    const v = this.cache.get(k);
    if (!v) return undefined;
    if (Date.now() - v.checkedAt > MOD_TTL_MS) {
      this.cache.delete(k);
      return undefined;
    }
    return v;
  }

  private fromVotes(votes: ActiveVote[] | undefined): { blocked: boolean; by: string[] } {
    if (!Array.isArray(votes)) return { blocked: false, by: [] };
    const by: string[] = [];
    for (const v of votes) {
      const voter = (v.voter || '').toLowerCase();
      if (!allowlist.has(voter)) continue;
      const negative = (typeof v.percent === 'number' && v.percent < 0) || (typeof v.rshares === 'number' && v.rshares < 0);
      if (negative) by.push(voter);
    }
    return { blocked: by.length > 0, by };
  }

  fromActiveVotes(author: string, permlink: string, activeVotes?: ActiveVote[]): ModerationVerdict | undefined {
    const k = this.key(author, permlink);
    const { blocked, by } = this.fromVotes(activeVotes);
    if (blocked) {
      const verdict: ModerationVerdict = { isBlocked: true, checkedAt: Date.now(), by };
      this.cache.set(k, verdict);
      return verdict;
    }
    return undefined;
  }

  async ensureChecked(author: string, permlink: string): Promise<ModerationVerdict> {
    const k = this.key(author, permlink);
    const cached = this.getCached(author, permlink);
    if (cached) return cached;

    const existing = this.inFlight.get(k);
    if (existing) return existing;

    const p = (async (): Promise<ModerationVerdict> => {
      try {
        // Fetch votes and validate the response shape defensively before use
        const raw: unknown = await hiveCallWithFailover(client => client.database.call('get_active_votes', [author, permlink]));
        const votes: ActiveVote[] | undefined = Array.isArray(raw)
          ? (raw.filter((v: any) => v && typeof v.voter === 'string') as ActiveVote[])
          : undefined;
        const { blocked, by } = this.fromVotes(votes);
        const verdict: ModerationVerdict = { isBlocked: blocked, checkedAt: Date.now(), by: blocked ? by : undefined };
        this.cache.set(k, verdict);
        return verdict;
      } catch (e) {
        // On error, return a non-blocking verdict; caller may retry later.
        return { isBlocked: false, checkedAt: Date.now() };
      } finally {
        this.inFlight.delete(k);
      }
    })();

    this.inFlight.set(k, p);
    return p;
  }
}

export const ModerationService = new ModerationServiceImpl();
