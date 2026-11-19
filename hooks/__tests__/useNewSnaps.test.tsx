/**
 * Tests for useNewSnaps: polls only while enabled, counts snaps newer than
 * the feed, recounts when the feed catches up, and reports nothing while
 * disabled.
 */

jest.mock('../../services/HiveClient', () => ({ getClient: jest.fn() }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useNewSnaps, type NewSnapsState } from '../useNewSnaps';
import { getClient } from '../../services/HiveClient';
import type { FilterableSnap } from '../../utils/feedFilter';

const mockCall = jest.fn();
const snap = (author: string, created: string): FilterableSnap => ({ author, permlink: `${author}-p`, created });

interface Props {
    enabled: boolean;
    known: FilterableSnap[];
    isRelevant?: (s: FilterableSnap) => boolean;
}

const all = (): boolean => true;

function renderHook(props: Props): { container: { result: NewSnapsState<FilterableSnap> }; update: (p: Props) => void } {
    const container = { result: null as unknown as NewSnapsState<FilterableSnap> };
    const Test = (p: Props): null => {
        container.result = useNewSnaps({
            enabled: p.enabled,
            known: p.known,
            isRelevant: p.isRelevant ?? all,
            currentUser: 'me',
            intervalMs: 1000,
        });
        return null;
    };
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Test, props)); });
    return { container, update: (p): void => { act(() => { renderer.update(React.createElement(Test, p)); }); } };
}

/** Advance one poll interval and let the RPC promises settle. */
const tick = async (): Promise<void> => {
    await act(async () => {
        jest.advanceTimersByTime(1000);
    });
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
};

let latest: FilterableSnap[] = [];

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    latest = [];
    mockCall.mockImplementation(async (method: string) => {
        if (method === 'get_discussions_by_blog') return [{ author: 'peak.snaps', permlink: 'snaps-1' }];
        if (method === 'get_content_replies') return latest;
        return [];
    });
    (getClient as jest.Mock).mockReturnValue({ database: { call: mockCall } });
});

afterEach(() => {
    jest.useRealTimers();
});

const known = [snap('alice', '2026-11-19T10:00:00')];

it('counts snaps newer than the feed on each poll', async () => {
    const { container } = renderHook({ enabled: true, known });
    expect(container.result.newSnaps).toEqual([]);

    latest = [snap('bob', '2026-11-19T10:02:00'), snap('carol', '2026-11-19T10:01:00'), ...known];
    await tick();

    expect(container.result.newSnaps.map((s) => s.author)).toEqual(['bob', 'carol']);
});

it('does not poll while disabled, and reports nothing', async () => {
    const { container, update } = renderHook({ enabled: true, known });
    latest = [snap('bob', '2026-11-19T10:02:00')];
    await tick();
    expect(container.result.newSnaps).toHaveLength(1);

    update({ enabled: false, known });
    expect(container.result.newSnaps).toEqual([]);
    mockCall.mockClear();
    await tick();
    expect(mockCall).not.toHaveBeenCalled();
});

it('drops snaps the feed already has after it refreshes', async () => {
    const { container, update } = renderHook({ enabled: true, known });
    const bob = snap('bob', '2026-11-19T10:02:00');
    latest = [bob, ...known];
    await tick();
    expect(container.result.newSnaps).toHaveLength(1);

    update({ enabled: true, known: [bob, ...known] });
    expect(container.result.newSnaps).toEqual([]);
});

it('recounts when the view filter changes, and reset clears the count', async () => {
    const { container, update } = renderHook({ enabled: true, known });
    latest = [snap('bob', '2026-11-19T10:02:00'), snap('carol', '2026-11-19T10:01:00')];
    await tick();
    expect(container.result.newSnaps).toHaveLength(2);

    update({ enabled: true, known, isRelevant: (s) => s.author === 'carol' });
    expect(container.result.newSnaps.map((s) => s.author)).toEqual(['carol']);

    act(() => container.result.reset());
    expect(container.result.newSnaps).toEqual([]);
});

it('keeps the last count when a poll fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = renderHook({ enabled: true, known });
    latest = [snap('bob', '2026-11-19T10:02:00')];
    await tick();
    mockCall.mockRejectedValue(new Error('node down'));
    await tick();
    expect(container.result.newSnaps).toHaveLength(1);
    warn.mockRestore();
});

it('does not loop when `known` is a new array on every render', async () => {
    const { container, update } = renderHook({ enabled: true, known: [...known] });
    latest = [snap('bob', '2026-11-19T10:02:00'), ...known];
    await tick();
    const first = container.result.newSnaps;
    update({ enabled: true, known: [...known] });
    update({ enabled: true, known: [...known] });
    expect(container.result.newSnaps).toBe(first);
});
