/**
 * Tests for usePointsSummary — fetches a user's points summary on mount/
 * username change, and reacts live to a pointsEvents "earned" notification
 * with an optimistic bump followed by a refetch.
 */

jest.mock('../../services/pointsService', () => ({
  fetchPointsSummary: jest.fn(),
}));

jest.mock('../../utils/pointsEvents', () => ({
  onPointsEarned: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { usePointsSummary, UsePointsSummaryResult } from '../usePointsSummary';
import { fetchPointsSummary } from '../../services/pointsService';
import { onPointsEarned } from '../../utils/pointsEvents';

const mockFetchPointsSummary = fetchPointsSummary as jest.Mock;
const mockOnPointsEarned = onPointsEarned as jest.Mock;

// `container` is mutated in place on every re-render, so callers must read
// `container.result` fresh after each `act()` rather than destructuring it
// once — the hook returns a new object per render.
function renderUsePointsSummary(username: string | null | undefined): { result: UsePointsSummaryResult } {
  const container: { result: UsePointsSummaryResult } = { result: null as unknown as UsePointsSummaryResult };
  const TestComponent = () => { container.result = usePointsSummary(username); return null; };
  act(() => { create(React.createElement(TestComponent)); });
  return container;
}

describe('usePointsSummary', () => {
  let earnedListener: ((detail: { awarded: number; balance: number }) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    earnedListener = null;
    mockOnPointsEarned.mockImplementation((cb: (detail: { awarded: number; balance: number }) => void) => {
      earnedListener = cb;
      return () => { earnedListener = null; };
    });
  });

  it('fetches and returns the summary on mount', async () => {
    mockFetchPointsSummary.mockResolvedValueOnce({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });

    const hook = renderUsePointsSummary('alice');
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.summary).toEqual({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });
    expect(hook.result.loading).toBe(false);
    expect(hook.result.error).toBeNull();
    expect(mockFetchPointsSummary).toHaveBeenCalledWith('alice');
  });

  it('returns a null summary and does not call the service when there is no username', async () => {
    const hook = renderUsePointsSummary(null);
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.summary).toBeNull();
    expect(mockFetchPointsSummary).not.toHaveBeenCalled();
  });

  it('sets an error and leaves summary null when the fetch fails', async () => {
    mockFetchPointsSummary.mockResolvedValueOnce(null);

    const hook = renderUsePointsSummary('alice');
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.summary).toBeNull();
    expect(hook.result.error).toBe('Failed to load points summary');
  });

  it('optimistically bumps balance/lifetimeEarned on a pointsEarned notification, then refetches', async () => {
    mockFetchPointsSummary.mockResolvedValueOnce({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });
    const hook = renderUsePointsSummary('alice');
    await act(async () => { await Promise.resolve(); });

    mockFetchPointsSummary.mockResolvedValueOnce({ username: 'alice', balance: 11, lifetimeEarned: 26, rank: 3 });

    expect(earnedListener).not.toBeNull();
    await act(async () => {
      earnedListener!({ awarded: 1, balance: 11 });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hook.result.summary?.balance).toBe(11);
    expect(hook.result.summary?.lifetimeEarned).toBe(26);
    expect(mockFetchPointsSummary).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes from pointsEvents on unmount', async () => {
    const unsubscribe = jest.fn();
    mockOnPointsEarned.mockImplementation(() => unsubscribe);
    mockFetchPointsSummary.mockResolvedValueOnce({ username: 'alice', balance: 10, lifetimeEarned: 25, rank: 3 });

    let renderer: ReturnType<typeof create> | null = null;
    const TestComponent = () => { usePointsSummary('alice'); return null; };
    act(() => { renderer = create(React.createElement(TestComponent)); });
    await act(async () => { await Promise.resolve(); });

    act(() => { renderer!.unmount(); });

    expect(unsubscribe).toHaveBeenCalled();
  });
});
