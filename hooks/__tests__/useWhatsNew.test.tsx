jest.mock('../../services/changelogService', () => ({
    getAppVersion: () => '1.5.0',
    loadChangelog: jest.fn(),
    getLastSeenVersion: jest.fn(),
    setLastSeenVersion: jest.fn(),
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWhatsNew, type UseWhatsNewResult } from '../useWhatsNew';
import { getLastSeenVersion, loadChangelog, setLastSeenVersion } from '../../services/changelogService';

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
    await act(async () => { resolveLoad(entries); });
    await flush();
    expect(h.current().visible).toBe(true);
    expect(loadChangelog).toHaveBeenCalledTimes(1);
});
