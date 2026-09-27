/**
 * Tests for useIncomingPayment — polls get_account_history for a transfer
 * matching what's being requested (recipient + currency + recency +
 * amount), mirroring snapie-io's QRRequestSheet polling logic.
 *
 * These only exercise the immediate first poll (no timer advancement
 * needed) but the hook does set up a real setInterval/setTimeout while
 * active, so each render is explicitly unmounted afterward to avoid
 * leaking timers across tests.
 */

jest.mock('../../services/HiveClient', () => ({
  getClient: jest.fn(),
}));

import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useIncomingPayment } from '../useIncomingPayment';
import { getClient } from '../../services/HiveClient';

const mockCall = jest.fn();
(getClient as jest.Mock).mockReturnValue({ database: { call: mockCall } });

let renderer: ReactTestRenderer | null = null;

function renderUseIncomingPayment(params: Parameters<typeof useIncomingPayment>[0]) {
  const container: { result: ReturnType<typeof useIncomingPayment> } = { result: null };
  const TestComponent = () => {
    container.result = useIncomingPayment(params);
    return null;
  };
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });
  return container;
}

function historyEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return [
    1,
    {
      trx_id: 'abc123',
      timestamp: new Date(Date.now() + 60_000).toISOString().slice(0, -1), // future, no trailing Z (blockchain style)
      op: ['transfer', { from: 'bob', to: 'alice', amount: '5.000 HIVE', memo: '' }],
      ...overrides,
    },
  ];
}

describe('useIncomingPayment', () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  it('does not poll when inactive', () => {
    renderUseIncomingPayment({ username: 'alice', active: false, expectedAmount: null, currency: 'HIVE' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('does not poll without a username', () => {
    renderUseIncomingPayment({ username: null, active: true, expectedAmount: null, currency: 'HIVE' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('detects a matching incoming transfer', async () => {
    mockCall.mockResolvedValue([historyEntry()]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: null,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toEqual({ from: 'bob', amount: '5.000 HIVE' });
  });

  it('ignores a transfer below the expected amount', async () => {
    mockCall.mockResolvedValue([
      historyEntry({ op: ['transfer', { from: 'bob', to: 'alice', amount: '1.000 HIVE', memo: '' }] }),
    ]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: 5,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toBeNull();
  });

  it('accepts an overpayment above the expected amount', async () => {
    mockCall.mockResolvedValue([
      historyEntry({ op: ['transfer', { from: 'bob', to: 'alice', amount: '10.000 HIVE', memo: '' }] }),
    ]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: 5,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toEqual({ from: 'bob', amount: '10.000 HIVE' });
  });

  it('ignores a transfer in the wrong currency', async () => {
    mockCall.mockResolvedValue([
      historyEntry({ op: ['transfer', { from: 'bob', to: 'alice', amount: '5.000 HBD', memo: '' }] }),
    ]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: null,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toBeNull();
  });

  it('ignores a transfer to someone else', async () => {
    mockCall.mockResolvedValue([
      historyEntry({ op: ['transfer', { from: 'bob', to: 'carol', amount: '5.000 HIVE', memo: '' }] }),
    ]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: null,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toBeNull();
  });

  it('ignores a transfer that predates when the request was opened', async () => {
    mockCall.mockResolvedValue([historyEntry({ timestamp: '2000-01-01T00:00:00' })]);

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: null,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toBeNull();
  });

  it('never throws when the history call rejects', async () => {
    mockCall.mockRejectedValue(new Error('network down'));

    const container = renderUseIncomingPayment({
      username: 'alice',
      active: true,
      expectedAmount: null,
      currency: 'HIVE',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result).toBeNull();
  });
});
