import { interleave, promoteToTop, promoteToTopOrMerge } from '../utils/interleave';

interface Item {
  author: string;
  permlink: string;
}

const base = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ author: `base-author-${i}`, permlink: `base-${i}` }));

const extra = (n: number, offset = 0): Item[] =>
  Array.from({ length: n }, (_, i) => ({ author: `wave-author-${i}`, permlink: `wave-${i + offset}` }));

describe('interleave', () => {
  it('returns the base list unchanged when there are no extras', () => {
    const result = interleave(base(5), [], { every: 2 });
    expect(result).toEqual(base(5));
  });

  it('splices one extra item after every N base items', () => {
    const result = interleave(base(6), extra(3), { every: 2 });
    expect(result.map(i => i.permlink)).toEqual([
      'base-0', 'base-1', 'wave-0',
      'base-2', 'base-3', 'wave-1',
      'base-4', 'base-5', 'wave-2',
    ]);
  });

  it('stops splicing once extras run out, without cycling back', () => {
    const result = interleave(base(10), extra(2), { every: 3 });
    expect(result.map(i => i.permlink)).toEqual([
      'base-0', 'base-1', 'base-2', 'wave-0',
      'base-3', 'base-4', 'base-5', 'wave-1',
      'base-6', 'base-7', 'base-8',
      'base-9',
    ]);
  });

  it('dedupes extras that share both author and permlink with a base item', () => {
    const b = base(4);
    const dupExtra = { author: 'base-author-1', permlink: 'base-1' }; // same identity as b[1]
    const result = interleave(b, [dupExtra, ...extra(1)], { every: 1 });
    // dupExtra is skipped entirely; only the genuinely new wave item is spliced in
    expect(result.map(i => i.permlink)).toEqual(['base-0', 'wave-0', 'base-1', 'base-2', 'base-3']);
  });

  it('does NOT dedupe an extra that shares a permlink but has a different author (Hive permlinks are only unique per-author)', () => {
    const b = base(2);
    const differentAuthorSamePermlink = { author: 'someone-else', permlink: 'base-1' };
    const result = interleave(b, [differentAuthorSamePermlink], { every: 1 });
    expect(result).toHaveLength(3);
    expect(result.filter(i => i.permlink === 'base-1')).toHaveLength(2);
  });

  it('dedupes extras that repeat a permlink among themselves', () => {
    const dupExtras = [
      { author: 'a', permlink: 'wave-x' },
      { author: 'b', permlink: 'wave-x' },
    ];
    const result = interleave(base(2), dupExtras, { every: 1 });
    // different authors, same permlink — not a real duplicate, both survive
    expect(result.filter(i => i.permlink === 'wave-x')).toHaveLength(2);
  });

  it('dedupes extras that repeat the same author AND permlink among themselves', () => {
    const dupExtras = [
      { author: 'a', permlink: 'wave-x' },
      { author: 'a', permlink: 'wave-x' },
    ];
    const result = interleave(base(2), dupExtras, { every: 1 });
    expect(result.filter(i => i.permlink === 'wave-x')).toHaveLength(1);
  });

  it('returns the base list unchanged when every <= 0', () => {
    const result = interleave(base(3), extra(2), { every: 0 });
    expect(result).toEqual(base(3));
  });

  it('does not mutate the input arrays', () => {
    const b = base(4);
    const e = extra(2);
    const bCopy = [...b];
    const eCopy = [...e];
    interleave(b, e, { every: 2 });
    expect(b).toEqual(bCopy);
    expect(e).toEqual(eCopy);
  });
});

describe('promoteToTop', () => {
  it('returns the base list unchanged when there are no extras', () => {
    const result = promoteToTop(base(5), [], { count: 3 });
    expect(result).toEqual(base(5));
  });

  it('prepends up to count extras to the front, leaving base order untouched', () => {
    const result = promoteToTop(base(4), extra(5), { count: 3 });
    expect(result.map(i => i.permlink)).toEqual([
      'wave-0', 'wave-1', 'wave-2',
      'base-0', 'base-1', 'base-2', 'base-3',
    ]);
  });

  it('prepends all extras when there are fewer than count', () => {
    const result = promoteToTop(base(3), extra(2), { count: 5 });
    expect(result.map(i => i.permlink)).toEqual(['wave-0', 'wave-1', 'base-0', 'base-1', 'base-2']);
  });

  it('dedupes extras that share both author and permlink with a base item', () => {
    const b = base(3);
    const dupExtra = { author: 'base-author-1', permlink: 'base-1' }; // same identity as b[1]
    const result = promoteToTop(b, [dupExtra, ...extra(1)], { count: 5 });
    expect(result.map(i => i.permlink)).toEqual(['wave-0', 'base-0', 'base-1', 'base-2']);
  });

  it('does NOT dedupe an extra that shares a permlink but has a different author', () => {
    const b = base(2);
    const differentAuthorSamePermlink = { author: 'someone-else', permlink: 'base-1' };
    const result = promoteToTop(b, [differentAuthorSamePermlink], { count: 5 });
    expect(result).toHaveLength(3);
    expect(result.filter(i => i.permlink === 'base-1')).toHaveLength(2);
  });

  it('dedupes extras that repeat the same author AND permlink among themselves', () => {
    const dupExtras = [
      { author: 'a', permlink: 'wave-x' },
      { author: 'a', permlink: 'wave-x' },
    ];
    const result = promoteToTop(base(2), dupExtras, { count: 5 });
    expect(result.filter(i => i.permlink === 'wave-x')).toHaveLength(1);
  });

  it('returns the base list unchanged when count <= 0', () => {
    const result = promoteToTop(base(3), extra(2), { count: 0 });
    expect(result).toEqual(base(3));
  });

  it('does not mutate the input arrays', () => {
    const b = base(4);
    const e = extra(2);
    const bCopy = [...b];
    const eCopy = [...e];
    promoteToTop(b, e, { count: 2 });
    expect(b).toEqual(bCopy);
    expect(e).toEqual(eCopy);
  });
});

describe('promoteToTopOrMerge', () => {
  interface Tagged extends Item {
    badge?: string;
  }
  interface Candidate extends Item {
    reason: string;
  }

  const mergeInto = (item: Tagged, extra: Candidate): Tagged => ({ ...item, badge: extra.reason });

  // A "new" candidate (no match in base) gets its own distinct author.
  const candidate = (permlink: string, reason = 'trending'): Candidate => ({ author: `c-${permlink}`, permlink, reason });
  // An "already visible" candidate must share both author AND permlink with
  // the base item it's meant to match — that's what real duplicate Hive
  // content looks like (permlinks are only unique per-author).
  const candidateFor = (baseItem: Item, reason = 'trending'): Candidate => ({ author: baseItem.author, permlink: baseItem.permlink, reason });

  it('returns the base list unchanged when there are no extras', () => {
    const result = promoteToTopOrMerge(base(3), [], { count: 5 }, mergeInto);
    expect(result).toEqual(base(3));
  });

  it('promotes extras with no match in base to the front', () => {
    const result = promoteToTopOrMerge(base(3), [candidate('new-1')], { count: 5 }, mergeInto);
    expect(result.map(i => i.permlink)).toEqual(['new-1', 'base-0', 'base-1', 'base-2']);
  });

  it('badges a base item in place instead of promoting or duplicating a matching extra', () => {
    const b = base(3);
    const result = promoteToTopOrMerge(b, [candidateFor(b[1], 'resurrected')], { count: 5 }, mergeInto) as Tagged[];

    expect(result.map(i => i.permlink)).toEqual(['base-0', 'base-1', 'base-2']); // unchanged order, no duplicate
    expect(result[1].badge).toBe('resurrected');
    expect(result[0].badge).toBeUndefined();
  });

  it('does NOT match an extra that shares a permlink but has a different author', () => {
    const b = base(2);
    const differentAuthorSamePermlink: Candidate = { author: 'someone-else', permlink: 'base-1', reason: 'trending' };
    const result = promoteToTopOrMerge(b, [differentAuthorSamePermlink], { count: 5 }, mergeInto) as Tagged[];

    // treated as new content and promoted, not merged into base-1
    expect(result.map(i => i.permlink)).toEqual(['base-1', 'base-0', 'base-1']);
    expect(result.find(i => i.author === 'base-author-1')?.badge).toBeUndefined();
  });

  it('handles a mix of matched (merged in place) and unmatched (promoted) extras', () => {
    const b = base(3);
    const result = promoteToTopOrMerge(
      b,
      [candidate('new-1'), candidateFor(b[1], 'resurrected')],
      { count: 5 },
      mergeInto
    ) as Tagged[];

    expect(result.map(i => i.permlink)).toEqual(['new-1', 'base-0', 'base-1', 'base-2']);
    expect(result.find(i => i.permlink === 'base-1')?.badge).toBe('resurrected');
  });

  it('caps only the promoted (unmatched) extras at count — merges are never capped', () => {
    const b = base(2);
    const result = promoteToTopOrMerge(
      b,
      [candidate('new-1'), candidate('new-2'), candidateFor(b[0], 'resurrected'), candidateFor(b[1], 'resurrected')],
      { count: 1 },
      mergeInto
    ) as Tagged[];

    expect(result.map(i => i.permlink)).toEqual(['new-1', 'base-0', 'base-1']);
    expect(result.find(i => i.permlink === 'base-0')?.badge).toBe('resurrected');
    expect(result.find(i => i.permlink === 'base-1')?.badge).toBe('resurrected');
  });

  it('dedupes extras that repeat the same author and permlink among themselves, keeping the first', () => {
    const result = promoteToTopOrMerge(
      base(2),
      [candidate('new-1', 'trending'), candidate('new-1', 'resurrected')],
      { count: 5 },
      mergeInto
    );
    expect(result.filter(i => i.permlink === 'new-1')).toHaveLength(1);
    expect((result[0] as Candidate).reason).toBe('trending');
  });

  it('still merges matched extras even when count is 0', () => {
    const b = base(2);
    const result = promoteToTopOrMerge(
      b,
      [candidate('new-1'), candidateFor(b[0], 'resurrected')],
      { count: 0 },
      mergeInto
    ) as Tagged[];

    expect(result.map(i => i.permlink)).toEqual(['base-0', 'base-1']); // new-1 not promoted, count is 0
    expect(result.find(i => i.permlink === 'base-0')?.badge).toBe('resurrected');
  });

  it('does not mutate the input arrays', () => {
    const b = base(3);
    const c = [candidate('new-1'), candidateFor(b[1], 'resurrected')];
    const bCopy = [...b];
    const cCopy = [...c];
    promoteToTopOrMerge(b, c, { count: 5 }, mergeInto);
    expect(b).toEqual(bCopy);
    expect(c).toEqual(cCopy);
  });
});
