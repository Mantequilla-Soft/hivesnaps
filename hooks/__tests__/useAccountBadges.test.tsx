jest.mock('../../services/badgesService', () => ({ fetchAccountBadges: jest.fn(), getCachedBadges: jest.fn(() => null) }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAccountBadges } from '../useAccountBadges';
import { fetchAccountBadges, getCachedBadges, type AccountBadge } from '../../services/badgesService';

const b = (account: string): AccountBadge => ({ account, name: account, about: '', image: 'https://x/y.png' });

it('loads badges for the profile and drops a late answer for the previous one', async () => {
    let resolveAlice!: (v: AccountBadge[]) => void;
    (fetchAccountBadges as jest.Mock)
        .mockImplementationOnce(() => new Promise((r) => { resolveAlice = r; }))
        .mockResolvedValueOnce([b('badge-bob')]);
    let latest: AccountBadge[] = [];
    const Test = ({ u }: { u: string }): null => {
        latest = useAccountBadges(u);
        return null;
    };
    let r!: ReactTestRenderer;
    act(() => { r = create(React.createElement(Test, { u: 'alice' })); });
    await act(async () => { r.update(React.createElement(Test, { u: 'bob' })); });
    await act(async () => { resolveAlice([b('badge-alice')]); });
    expect(latest.map((x) => x.account)).toEqual(['badge-bob']);
});

it('shows cached badges on the first render, with no empty flash', () => {
    (getCachedBadges as jest.Mock).mockReturnValueOnce([b('badge-cached')]).mockReturnValue([b('badge-cached')]);
    (fetchAccountBadges as jest.Mock).mockResolvedValue([b('badge-cached')]);
    const seen: string[][] = [];
    const Test = (): null => {
        seen.push(useAccountBadges('carol').map((x) => x.account));
        return null;
    };
    act(() => { create(React.createElement(Test)); });
    expect(seen[0]).toEqual(['badge-cached']);
    expect(seen.every((list) => list.length === 1)).toBe(true);
});
