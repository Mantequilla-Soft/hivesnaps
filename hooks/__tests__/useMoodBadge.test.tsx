jest.mock('../../services/moodBadgeService', () => ({
    getMoodBadge: jest.fn(),
    getCachedMoodBadge: jest.fn(() => null),
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useMoodBadge } from '../useMoodBadge';
import { getCachedMoodBadge, getMoodBadge } from '../../services/moodBadgeService';

function mount(account: string | null, enabled = true): { seen: (string | null)[]; update: (a: string | null, e?: boolean) => void; unmount: () => void } {
    const seen: (string | null)[] = [];
    const Test = ({ a, on }: { a: string | null; on: boolean }): null => {
        seen.push(useMoodBadge(a, on));
        return null;
    };
    let r!: ReactTestRenderer;
    act(() => { r = create(React.createElement(Test, { a: account, on: enabled })); });
    return {
        seen,
        update: (a, on = enabled) => act(() => { r.update(React.createElement(Test, { a, on })); }),
        unmount: () => act(() => r.unmount()),
    };
}
const flush = (): Promise<void> => act(async () => { await new Promise((res) => setTimeout(res, 0)); });

beforeEach(() => jest.clearAllMocks());

it("shows the account's badge once loaded", async () => {
    (getMoodBadge as jest.Mock).mockResolvedValue('sleepy');
    const h = mount('meno');
    await flush();
    expect(h.seen[h.seen.length - 1]).toBe('sleepy');
});

it("never shows the previous account's badge when the avatar switches accounts", async () => {
    (getMoodBadge as jest.Mock).mockImplementation(async (a: string) => (a === 'meno' ? 'sleepy' : null));
    const h = mount('meno');
    await flush();
    const before = h.seen.length;
    h.update('alice');
    // Every render after the switch, including the first, is alice's (none).
    expect(h.seen.slice(before)).not.toContain('sleepy');
    await flush();
    expect(h.seen[h.seen.length - 1]).toBeNull();
});

it('uses the cached badge on the first render, with no flash', () => {
    (getCachedMoodBadge as jest.Mock).mockReturnValue('bull');
    (getMoodBadge as jest.Mock).mockReturnValue(new Promise(() => {}));
    const h = mount('forkyishere');
    expect(h.seen[0]).toBe('bull');
});

it('does nothing when turned off or without an account', async () => {
    const off = mount('meno', false);
    const none = mount(null);
    await flush();
    expect(getMoodBadge).not.toHaveBeenCalled();
    expect([...off.seen, ...none.seen].every((v) => v === null)).toBe(true);
});

it('ignores a result that arrives after unmount', async () => {
    let resolve!: (v: string) => void;
    (getMoodBadge as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const h = mount('meno');
    h.unmount();
    await act(async () => { resolve('sleepy'); });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
});
