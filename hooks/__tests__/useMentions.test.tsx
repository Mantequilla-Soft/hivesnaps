jest.mock('../../services/usernameLookup', () => ({
    MIN_MENTION_QUERY: 3,
    searchUsernamesByPrefix: jest.fn(),
    validateUsernames: jest.fn(),
    getKnownValidity: jest.fn(),
}));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useMentions, type UseMentionsResult } from '../useMentions';
import { getKnownValidity, searchUsernamesByPrefix, validateUsernames } from '../../services/usernameLookup';

const search = searchUsernamesByPrefix as jest.Mock;
const validate = validateUsernames as jest.Mock;
const known = getKnownValidity as jest.Mock;

function render(text: string, cursor: number): { current: () => UseMentionsResult; update: (t: string, c: number) => void } {
    let latest!: UseMentionsResult;
    const Test = ({ t, c }: { t: string; c: number }): null => {
        latest = useMentions(t, c);
        return null;
    };
    let r!: ReactTestRenderer;
    act(() => { r = create(React.createElement(Test, { t: text, c: cursor })); });
    return { current: () => latest, update: (t, c) => act(() => { r.update(React.createElement(Test, { t, c })); }) };
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    known.mockReturnValue(null);
    validate.mockResolvedValue(new Set());
});
afterEach(() => jest.useRealTimers());

it('suggests after a pause once 3 characters are typed, and picks into the text', async () => {
    search.mockResolvedValue(['meno', 'menobass']);
    const h = render('hi @me', 6);
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(search).not.toHaveBeenCalled();

    h.update('hi @men', 7);
    await act(async () => { jest.advanceTimersByTime(299); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(search).toHaveBeenCalledWith('men', 6);
    expect(h.current().suggestions).toEqual(['meno', 'menobass']);
    expect(h.current().pick('menobass')).toEqual({ text: 'hi @menobass ', cursor: 13 });
});

it('drops suggestions as soon as the typed prefix changes, and ignores late answers', async () => {
    let resolveOld!: (v: string[]) => void;
    search.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; })).mockResolvedValueOnce(['menob']);
    const h = render('@men', 4);
    await act(async () => { jest.advanceTimersByTime(300); });
    h.update('@meno', 5);
    expect(h.current().suggestions).toEqual([]);
    await act(async () => { jest.advanceTimersByTime(300); });
    await act(async () => { resolveOld(['stale']); });
    expect(h.current().suggestions).toEqual(['menob']);
});

it('flags finished mentions that are not accounts, never the one being typed', async () => {
    known.mockImplementation((n: string) => (n === 'nobody' ? false : null));
    const h = render('hey @nobody and @nob', 20);
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(validate).toHaveBeenCalledWith(['nobody']);
    expect(h.current().unknownMentions).toEqual(['nobody']);
});
