import { useEffect, useRef, useState } from 'react';
import { getClient } from '../services/HiveClient';

// How often to check for the incoming payment while active — frequent
// enough to feel "live" for a person-to-person handoff without hammering
// the RPC node. Matches snapie-io's own QRRequestSheet polling.
const POLL_INTERVAL_MS = 5000;
// Safety net so leaving a request open unattended doesn't poll forever.
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

type RawHistoryEntry = [number, { trx_id: string; timestamp: string; op: [string, Record<string, unknown>] }];

export interface IncomingPayment {
  from: string;
  amount: string;
}

interface UseIncomingPaymentParams {
  username: string | null;
  /** Only polls while true — e.g. while a "Request Payment" sheet is open. */
  active: boolean;
  /** Minimum amount to match, or null to accept any amount in `currency`. */
  expectedAmount: number | null;
  currency: 'HIVE' | 'HBD';
}

/**
 * Polls the account's recent transfer history for a payment matching what's
 * being requested, so the requester doesn't have to manually refresh the
 * wallet to see whether they've been paid. Mirrors snapie-io's
 * QRRequestSheet: matches on recipient + currency + recency (after the
 * request was opened) + amount (allowing overpayment), ignoring memo.
 */
export function useIncomingPayment({
  username,
  active,
  expectedAmount,
  currency,
}: UseIncomingPaymentParams): IncomingPayment | null {
  const [payment, setPayment] = useState<IncomingPayment | null>(null);

  // Read via refs inside the poll loop rather than as effect deps, so
  // editing the amount/currency fields while a poll is already running
  // doesn't restart the interval (and lose the "since when" cutoff).
  const expectedAmountRef = useRef(expectedAmount);
  const currencyRef = useRef(currency);
  useEffect(() => {
    expectedAmountRef.current = expectedAmount;
  }, [expectedAmount]);
  useEffect(() => {
    currencyRef.current = currency;
  }, [currency]);

  useEffect(() => {
    if (!active || !username) {
      setPayment(null);
      return;
    }

    setPayment(null);
    const openedAt = new Date().toISOString();
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const raw: RawHistoryEntry[] = await getClient().database.call('get_account_history', [
          username,
          -1,
          50,
        ]);
        if (cancelled) return;

        const expected = expectedAmountRef.current;
        const wantCurrency = currencyRef.current;

        for (const [, entry] of raw) {
          const [opType, opData] = entry.op;
          if (opType !== 'transfer') continue;

          const to = opData.to as string;
          const from = opData.from as string;
          const amount = opData.amount as string;

          if (to !== username) continue;
          if (entry.timestamp <= openedAt) continue;
          if (!amount.endsWith(wantCurrency)) continue;
          if (expected !== null && parseFloat(amount) < expected) continue;

          setPayment({ from, amount });
          clearInterval(intervalId);
          return;
        }
      } catch {
        // Transient RPC hiccup — just try again next tick.
      }
    };

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);
    const timeoutId = setTimeout(() => clearInterval(intervalId), POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [active, username]);

  return payment;
}
