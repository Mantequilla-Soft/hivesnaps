/**
 * Tests for useSnapCast — polls the root's `children` count and refetches the
 * thread only when it grows (and not for our own just-posted reply).
 */

const mockCall = jest.fn();
jest.mock('../../services/HiveClient', () => ({
  getClient: () => ({ database: { call: (...a: unknown[]) => mockCall(...a) } }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-av', () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { useSnapCast } from '../useSnapCast';

function mount(enabled: boolean, refresh: () => Promise<unknown>) {
  const box: { result: ReturnType<typeof useSnapCast> | null } = { result: null };
  const C = () => { box.result = useSnapCast({ author: 'a', permlink: 'p', enabled, refresh }); return null; };
  act(() => { create(React.createElement(C)); });
  return box as { result: ReturnType<typeof useSnapCast> };
}

const tick = () => act(async () => { jest.advanceTimersByTime(4_000); });

describe('useSnapCast', () => {
  beforeEach(() => { jest.useFakeTimers(); mockCall.mockReset(); });
  afterEach(() => { jest.useRealTimers(); });

  it('does not poll when disabled', async () => {
    mount(false, jest.fn());
    await tick();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('refreshes only when the reply count grows', async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    mockCall.mockResolvedValue({ children: 2 });
    mount(true, refresh);
    await act(async () => {}); // first poll sets the baseline
    expect(refresh).not.toHaveBeenCalled();

    await tick(); // unchanged
    expect(refresh).not.toHaveBeenCalled();

    mockCall.mockResolvedValue({ children: 3 });
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('survives a failed poll and keeps going', async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    mockCall.mockResolvedValueOnce({ children: 1 }).mockRejectedValueOnce(new Error('rpc')).mockResolvedValue({ children: 2 });
    mount(true, refresh);
    await act(async () => {});
    await tick();
    await tick();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
