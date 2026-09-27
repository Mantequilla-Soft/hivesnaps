/**
 * Tests for usePatronList — a thin bridge from patronService's own
 * module-level cache into React state for the feed's "Patrons" filter.
 */

jest.mock('../../services/patronService', () => ({
  getPatronsMap: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { usePatronList } from '../usePatronList';
import { getPatronsMap } from '../../services/patronService';

const mockGetPatronsMap = getPatronsMap as jest.Mock;

// `container` is mutated in place on every re-render — read container.result
// fresh after each act() rather than destructuring it once.
function renderUsePatronList(): { result: ReturnType<typeof usePatronList> } {
  const container: { result: ReturnType<typeof usePatronList> | null } = { result: null };
  const TestComponent = () => { container.result = usePatronList(); return null; };
  act(() => { create(React.createElement(TestComponent)); });
  if (container.result === null) {
    throw new Error('usePatronList did not render synchronously');
  }
  return container as { result: ReturnType<typeof usePatronList> };
}

describe('usePatronList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts loading and populates patronSet once the map resolves', async () => {
    mockGetPatronsMap.mockResolvedValueOnce(
      new Map([
        ['alice', 'snap-master'],
        ['bob', 'snaperino'],
      ])
    );

    const container = renderUsePatronList();
    expect(container.result.loading).toBe(true);
    expect(container.result.patronSet.size).toBe(0);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result.loading).toBe(false);
    expect(container.result.patronSet.has('alice')).toBe(true);
    expect(container.result.patronSet.has('bob')).toBe(true);
    expect(container.result.patronSet.has('carol')).toBe(false);
  });

  it('resolves to an empty set, not an error, when there are no patrons', async () => {
    mockGetPatronsMap.mockResolvedValueOnce(new Map());

    const container = renderUsePatronList();

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result.loading).toBe(false);
    expect(container.result.patronSet.size).toBe(0);
  });

  it('leaves loading false and rethrows nothing visible when the fetch fails', async () => {
    mockGetPatronsMap.mockRejectedValueOnce(new Error('network down'));

    const container = renderUsePatronList();

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.result.loading).toBe(false);
    expect(container.result.patronSet.size).toBe(0);
  });
});
