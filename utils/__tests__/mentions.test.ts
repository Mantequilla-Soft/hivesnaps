import { extractMentions, getMentionDraft, insertMention, normalizeMentionToken } from '../mentions';

it('normalizes mention tokens', () => {
    expect(normalizeMentionToken('@Alice.')).toBe('alice');
    expect(normalizeMentionToken('@a-b.c--')).toBe('a-b.c');
});

it('extracts distinct mentions in order', () => {
    expect(extractMentions('hi @Bob and @alice, also @bob.')).toEqual(['bob', 'alice']);
    expect(extractMentions('email me@gmail.com or a@b')).toEqual([]);
    expect(extractMentions('(@carol) [@dave] "@erin"')).toEqual(['carol', 'dave', 'erin']);
    expect(extractMentions('@start\n@next line')).toEqual(['start', 'next']);
});

describe('getMentionDraft', () => {
    it('finds the mention being typed at the cursor', () => {
        expect(getMentionDraft('hi @Ali', 7)).toEqual({ start: 3, end: 7, query: 'ali' });
        expect(getMentionDraft('@', 1)).toEqual({ start: 0, end: 1, query: '' });
    });

    it('ignores mentions away from the cursor and @ inside words', () => {
        expect(getMentionDraft('hi @alice and more', 18)).toBeNull();
        expect(getMentionDraft('hi @alice ', 10)).toBeNull();
        expect(getMentionDraft('mail me@exam', 12)).toBeNull();
        expect(getMentionDraft('hi @ali and', 7)).toEqual({ start: 3, end: 7, query: 'ali' });
    });
});

it('inserts the picked name with one trailing space and puts the cursor after it', () => {
    const draft = getMentionDraft('hi @ali', 7)!;
    expect(insertMention('hi @ali', draft, 'alice')).toEqual({ text: 'hi @alice ', cursor: 10 });
    const mid = getMentionDraft('hi @ali there', 7)!;
    expect(insertMention('hi @ali there', mid, 'alice')).toEqual({ text: 'hi @alice there', cursor: 10 });
});
