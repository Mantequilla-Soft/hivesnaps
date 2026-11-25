import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useActivitySummary, MAX_BACKFILL_PAGES } from '../useActivitySummary';
import type { ParsedNotification } from '../../utils/notifications';

const hiveDate = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString().replace('Z', '').slice(0, 19);
const DAY = 86_400_000;
let nextId = 1;
const item = (type: string, msAgo: number): ParsedNotification =>
    ({ id: nextId++, type, date: hiveDate(msAgo), msg: '', url: '', score: 0, icon: 'bell', color: '#000', actionText: '' });

type Result = ReturnType<typeof useActivitySummary>;
interface Props { notifications: ParsedNotification[]; hasMore: boolean; loadingMore: boolean; loadMore: () => Promise<void>; listVersion?: number }

function mount(props: Props): { get: () => Result; update: (p: Partial<Props>) => void } {
    let latest!: Result;
    let current: Props = { listVersion: 1, ...props };
    const Test = (p: Props): null => { latest = useActivitySummary({ ...p, listVersion: p.listVersion ?? 1 }); return null; };
    let r!: ReactTestRenderer;
    act(() => { r = create(React.createElement(Test, current)); });
    return {
        get: () => latest,
        update: (p) => { current = { ...current, ...p }; act(() => { r.update(React.createElement(Test, current)); }); },
    };
}

it('loads older pages until the week is covered, then stops', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    const recent = [item('vote', DAY), item('reply', 2 * DAY)];
    const h = mount({ notifications: recent, hasMore: true, loadingMore: false, loadMore });
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(h.get().backfilling).toBe(true);

    // The next page reaches past the week: no more loading.
    h.update({ notifications: [...recent, item('follow', 9 * DAY)] });
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(h.get().backfilling).toBe(false);
});

it('does not backfill once the history has run out', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    mount({ notifications: [item('vote', DAY)], hasMore: false, loadingMore: false, loadMore });
    expect(loadMore).not.toHaveBeenCalled();
});

it('backfills Today too, until a notification from before midnight is loaded', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    const h = mount({ notifications: [item('vote', 1000)], hasMore: true, loadingMore: false, loadMore });
    act(() => h.get().setRange('today'));
    loadMore.mockClear();
    h.update({ notifications: [item('vote', 1000), item('vote', 2000)] }); // still today
    expect(loadMore).toHaveBeenCalledTimes(1);
    h.update({ notifications: [item('vote', 1000), item('vote', 2000), item('vote', 2 * DAY)] });
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(h.get().backfilling).toBe(false);
});

it(`gives up after ${MAX_BACKFILL_PAGES} pages`, () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    let list = [item('vote', 1000)];
    const h = mount({ notifications: list, hasMore: true, loadingMore: false, loadMore });
    for (let i = 0; i < MAX_BACKFILL_PAGES + 5; i++) {
        list = [...list, item('vote', 2000 + i)]; // every page still inside the week
        h.update({ notifications: list });
    }
    expect(loadMore).toHaveBeenCalledTimes(MAX_BACKFILL_PAGES);
    expect(h.get().backfilling).toBe(false);
});

it('waits while a page is already loading', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    mount({ notifications: [item('vote', DAY)], hasMore: true, loadingMore: true, loadMore });
    expect(loadMore).not.toHaveBeenCalled();
});

it('filters the list by tile, and a second tap shows everything again', () => {
    const list = [item('vote', DAY), item('reply', DAY), item('reply_comment', DAY), item('follow', 10 * DAY)];
    const h = mount({ notifications: list, hasMore: false, loadingMore: false, loadMore: jest.fn() });
    expect(h.get().tiles.map((t) => t.filter)).toEqual(['votes', 'replies']);
    act(() => h.get().toggleFilter('replies'));
    expect(h.get().visible.map((n) => n.type)).toEqual(['reply', 'reply_comment']);
    act(() => h.get().toggleFilter('replies'));
    expect(h.get().visible).toHaveLength(4);
});

function capped(): { h: ReturnType<typeof mount>; loadMore: jest.Mock } {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    let list = [item('vote', 1000)];
    const h = mount({ notifications: list, hasMore: true, loadingMore: false, loadMore });
    for (let i = 0; i < MAX_BACKFILL_PAGES + 2; i++) {
        list = [...list, item('vote', 2000 + i)];
        h.update({ notifications: list });
    }
    expect(loadMore).toHaveBeenCalledTimes(MAX_BACKFILL_PAGES);
    loadMore.mockClear();
    return { h, loadMore };
}

it('starts a fresh page budget after a refresh replaces the list', () => {
    const { h, loadMore } = capped();
    h.update({ notifications: [item('vote', 1000)], listVersion: 2 });
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(h.get().backfilling).toBe(true);
});

it('resumes loading when switching to a wider range after the cap', () => {
    const { h, loadMore } = capped();
    expect(h.get().backfilling).toBe(false);
    act(() => h.get().setRange('month'));
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(h.get().backfilling).toBe(true);
});
