jest.mock('../../services/changelogService', () => ({
    getAppVersion: () => '1.5.0',
    loadChangelog: jest.fn(),
    getLastSeenVersion: jest.fn(),
    setLastSeenVersion: jest.fn(),
    getShowOnUpdate: jest.fn(),
    setShowOnUpdate: jest.fn(),
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
    resetWhatsNewCacheForTests,
    useShowWhatsNewOnUpdate,
    useUnseenWhatsNew,
    useWhatsNew,
    type UseWhatsNewResult,
} from '../useWhatsNew';
import {
    getLastSeenVersion,
    getShowOnUpdate,
    loadChangelog,
    setLastSeenVersion,
    setShowOnUpdate,
} from '../../services/changelogService';

const entries = ['1.5.0', '1.4.0'].map((version) => ({ version, date: '2026-01-01', items: [{ type: 'feature' as const, text: version }] }));

function render(
    enabled: boolean,
    canShow = true
): { current: () => UseWhatsNewResult; update: (e: boolean, c?: boolean) => void } {
    let latest!: UseWhatsNewResult;
    const Test = ({ on, show }: { on: boolean; show: boolean }): null => {
        latest = useWhatsNew(on, show);
        return null;
    };
    let r!: ReactTestRenderer;
    act(() => { r = create(React.createElement(Test, { on: enabled, show: canShow })); });
    return {
        current: () => latest,
        update: (on, show = canShow) => act(() => { r.update(React.createElement(Test, { on, show })); }),
    };
}
const flush = (): Promise<void> => act(async () => { await new Promise((res) => setTimeout(res, 0)); });

beforeEach(() => {
    jest.clearAllMocks();
    (loadChangelog as jest.Mock).mockResolvedValue(entries);
    resetWhatsNewCacheForTests();
    // The popup tests below are for users who turned it on in Profile.
    (getShowOnUpdate as jest.Mock).mockResolvedValue(true);
});

it('shows no popup unless the user turned it on in Profile', async () => {
    (getShowOnUpdate as jest.Mock).mockResolvedValue(false);
    (getLastSeenVersion as jest.Mock).mockResolvedValue('1.4.0');
    const h = render(true);
    await flush();
    expect(h.current().visible).toBe(false);
    expect(h.current().entries).toEqual([]);
    // Nothing is marked seen, so the Profile row keeps its "New" label.
    expect(setLastSeenVersion).not.toHaveBeenCalled();
});

describe('useUnseenWhatsNew (the "New" label on Profile)', () => {
    function renderLabel(key: number, enabled = true): { value: () => boolean; update: (k: number, e?: boolean) => void } {
        let latest = false;
        const Test = ({ k, on }: { k: number; on: boolean }): null => {
            latest = useUnseenWhatsNew(k, on);
            return null;
        };
        let r!: ReactTestRenderer;
        act(() => { r = create(React.createElement(Test, { k: key, on: enabled })); });
        return {
            value: () => latest,
            update: (k, on = enabled) => act(() => { r.update(React.createElement(Test, { k, on })); }),
        };
    }

    it("is on until the installed version's notes are seen, and re-checks when asked", async () => {
        (getLastSeenVersion as jest.Mock).mockResolvedValue('1.4.0');
        const label = renderLabel(1);
        await flush();
        expect(label.value()).toBe(true);

        (getLastSeenVersion as jest.Mock).mockResolvedValue('1.5.0'); // the notes were opened
        label.update(2);
        await flush();
        expect(label.value()).toBe(false);
        expect(loadChangelog).toHaveBeenCalledTimes(1); // the changelog is fetched once per run
    });

    it("shows on a fresh install (nothing seen yet) and stays off on someone else's profile", async () => {
        (getLastSeenVersion as jest.Mock).mockResolvedValue(null);
        const other = renderLabel(1, false);
        await flush();
        expect(other.value()).toBe(false);
        expect(loadChangelog).not.toHaveBeenCalled();

        other.update(2, true);
        await flush();
        expect(other.value()).toBe(true);
    });
});

describe('useShowWhatsNewOnUpdate (the Profile switch)', () => {
    function renderSwitch(): { value: () => boolean; set: (on: boolean) => void } {
        let latest!: [boolean, (on: boolean) => void];
        const Test = (): null => {
            latest = useShowWhatsNewOnUpdate(true);
            return null;
        };
        act(() => { create(React.createElement(Test)); });
        return { value: () => latest[0], set: (on) => act(() => latest[1](on)) };
    }

    it('loads the saved setting and saves a change', async () => {
        (getShowOnUpdate as jest.Mock).mockResolvedValue(true);
        (setShowOnUpdate as jest.Mock).mockResolvedValue(true);
        const sw = renderSwitch();
        await flush();
        expect(sw.value()).toBe(true);
        sw.set(false);
        await flush();
        expect(sw.value()).toBe(false);
        expect(setShowOnUpdate).toHaveBeenCalledWith(false);
    });

    it('keeps a tap made before the saved value loads', async () => {
        let resolveSaved!: (v: boolean) => void;
        (getShowOnUpdate as jest.Mock).mockReturnValue(new Promise((r) => { resolveSaved = r; }));
        (setShowOnUpdate as jest.Mock).mockResolvedValue(true);
        const sw = renderSwitch();
        sw.set(true);
        await act(async () => { resolveSaved(false); });
        await flush();
        expect(sw.value()).toBe(true);
    });

    it("undoes a change that couldn't be saved", async () => {
        (getShowOnUpdate as jest.Mock).mockResolvedValue(false);
        (setShowOnUpdate as jest.Mock).mockResolvedValue(false);
        const sw = renderSwitch();
        await flush();
        sw.set(true);
        await flush();
        expect(sw.value()).toBe(false);
    });
});

it('waits until enabled, then shows the versions not seen yet', async () => {
    (getLastSeenVersion as jest.Mock).mockResolvedValue('1.4.0');
    const h = render(false);
    await flush();
    expect(loadChangelog).not.toHaveBeenCalled();

    h.update(true);
    await flush();
    expect(h.current().visible).toBe(true);
    expect(h.current().entries.map((e) => e.version)).toEqual(['1.5.0']);
});

it('stays hidden when everything was seen, and checks only once', async () => {
    (getLastSeenVersion as jest.Mock).mockResolvedValue('1.5.0');
    const h = render(true);
    await flush();
    h.update(false);
    h.update(true);
    await flush();
    expect(h.current().visible).toBe(false);
    expect(loadChangelog).toHaveBeenCalledTimes(1);
});

it('remembers the installed version when dismissed', async () => {
    (getLastSeenVersion as jest.Mock).mockResolvedValue(null);
    const h = render(true);
    await flush();
    expect(h.current().entries.map((e) => e.version)).toEqual(['1.5.0']);
    act(() => h.current().dismiss());
    expect(h.current().visible).toBe(false);
    expect(setLastSeenVersion).toHaveBeenCalledWith('1.5.0');
});

it('waits for the feed to be on screen before showing', async () => {
    (getLastSeenVersion as jest.Mock).mockResolvedValue('1.4.0');
    const h = render(true, false);
    await flush();
    expect(h.current().entries.map((e) => e.version)).toEqual(['1.5.0']);
    expect(h.current().visible).toBe(false);
    h.update(true, true);
    expect(h.current().visible).toBe(true);
});

it('keeps the result when enabled flickers while the check is in flight', async () => {
    let resolveLoad!: (v: typeof entries) => void;
    (loadChangelog as jest.Mock).mockImplementationOnce(() => new Promise((r) => { resolveLoad = r; }));
    (getLastSeenVersion as jest.Mock).mockResolvedValue('1.4.0');
    const h = render(true);
    h.update(false);
    h.update(true);
    await flush(); // the popup setting is read first; then the changelog load starts
    await act(async () => { resolveLoad(entries); });
    await flush();
    expect(h.current().visible).toBe(true);
    expect(loadChangelog).toHaveBeenCalledTimes(1);
});
