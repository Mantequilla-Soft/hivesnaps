import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchPointsSummary, PointsSummary } from '../services/pointsService';
import { onPointsEarned, PointsEarnedDetail } from '../utils/pointsEvents';

export interface UsePointsSummaryResult {
  summary: PointsSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Fetches a user's points summary and keeps it live: refetches on username
// change and optimistically bumps balance/lifetimeEarned the instant THIS
// device earns (pointsEvents carries the fresh balance). Rank depends on
// every other account, so it can't be computed optimistically — a real
// refetch follows shortly after to correct it.
export function usePointsSummary(username: string | null | undefined): UsePointsSummaryResult {
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    if (!username) {
      if (isMountedRef.current) setSummary(null);
      return;
    }
    if (isMountedRef.current) { setLoading(true); setError(null); }
    try {
      const result = await fetchPointsSummary(username);
      if (!isMountedRef.current) return;
      if (result) {
        setSummary(result);
      } else {
        setError('Failed to load points summary');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    return onPointsEarned((detail: PointsEarnedDetail) => {
      setSummary(prev =>
        prev
          ? { ...prev, balance: detail.balance, lifetimeEarned: prev.lifetimeEarned + detail.awarded }
          : prev
      );
      void refetch();
    });
  }, [refetch]);

  return { summary, loading, error, refetch };
}
