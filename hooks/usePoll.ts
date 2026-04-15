import { useState, useEffect, useCallback, useRef } from 'react';
import { accountStorageService } from '../services/AccountStorageService';
import { localAuthService, AuthCancelledError } from '../services/LocalAuthService';
import { fetchPollResults, votePoll, PollResults } from '../services/PollService';

export interface UsePollResult {
  results: PollResults | null;
  loading: boolean;
  error: string | null;
  voted: boolean;
  userChoices: number[];
  voting: boolean;
  voteError: string | null;
  keyInputVisible: boolean;
  keyInput: string;
  setKeyInput: (val: string) => void;
  vote: (choices: number[]) => Promise<void>;
}

export function usePoll(
  author: string,
  permlink: string,
  currentUsername: string | null
): UsePollResult {
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [keyInputVisible, setKeyInputVisible] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const pendingChoicesRef = useRef<number[] | null>(null);
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadResults = useCallback(async () => {
    if (!isMountedRef.current) return;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPollResults(author, permlink);
      if (isMountedRef.current && loadRequestIdRef.current === requestId) setResults(data);
    } catch (err) {
      if (isMountedRef.current && loadRequestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : 'Failed to load poll results');
      }
    } finally {
      if (isMountedRef.current && loadRequestIdRef.current === requestId) setLoading(false);
    }
  }, [author, permlink]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const currentUserLower = currentUsername?.toLowerCase() ?? '';

  const voted = !!(
    currentUsername &&
    results?.poll_voters?.some((v) => v.name?.toLowerCase() === currentUserLower)
  );

  const userChoices: number[] = currentUsername
    ? (results?.poll_voters?.find((v) => v.name?.toLowerCase() === currentUserLower)?.choices ?? [])
    : [];

  const castVote = useCallback(async (choices: number[], keyStr: string) => {
    if (!currentUsername) return;
    if (!isMountedRef.current) return;
    setVoting(true);
    setVoteError(null);
    try {
      await votePoll(currentUsername, author, permlink, choices, keyStr);
      // Refetch after a short delay for the node to process
      await new Promise((r) => setTimeout(r, 2000));
      await loadResults();
      if (isMountedRef.current) {
        setKeyInputVisible(false);
        setKeyInput('');
        pendingChoicesRef.current = null;
      }
    } catch (err) {
      if (isMountedRef.current) {
        setVoteError(err instanceof Error ? err.message : 'Vote failed');
        setKeyInput(''); // Clear key from memory on error
      }
    } finally {
      if (isMountedRef.current) setVoting(false);
    }
  }, [currentUsername, author, permlink, loadResults]);

  const vote = useCallback(async (choices: number[]) => {
    if (!currentUsername) return;
    setVoteError(null);

    // Try stored posting key + biometrics first
    try {
      const keys = await accountStorageService.getAccountKeys(currentUsername);
      if (keys?.postingKey) {
        const biometricAvailable = await localAuthService.isAvailable();
        if (biometricAvailable) {
          await localAuthService.authenticate();
          await castVote(choices, keys.postingKey);
          return;
        }
      }
    } catch (err) {
      if (err instanceof AuthCancelledError) return;
      // Fall through to manual key entry
    }

    // No stored key (or biometric not available) — show inline key input
    pendingChoicesRef.current = choices;
    if (isMountedRef.current) setKeyInputVisible(true);
  }, [currentUsername, castVote]);

  // Called from PollWidget when user submits inline key
  const voteWithInlineKey = useCallback(async (): Promise<void> => {
    const choices = pendingChoicesRef.current;
    if (!choices || !keyInput.trim()) return;
    await castVote(choices, keyInput);
  }, [keyInput, castVote]);

  return {
    results,
    loading,
    error,
    voted,
    userChoices,
    voting,
    voteError,
    keyInputVisible,
    keyInput,
    setKeyInput,
    vote: async (choices: number[]): Promise<void> => {
      // If key input visible, treat as submission with current keyInput
      if (keyInputVisible) {
        await voteWithInlineKey();
      } else {
        await vote(choices);
      }
    },
  };
}
