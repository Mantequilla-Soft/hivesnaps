import { interleave, promoteToTop } from '../utils/interleave';

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

  it('dedupes extras that share a permlink with a base item', () => {
    const b = base(4);
    const dupExtra = { author: 'dup', permlink: 'base-1' };
    const result = interleave(b, [dupExtra, ...extra(1)], { every: 1 });
    // dupExtra is skipped entirely; only the genuinely new wave item is spliced in
    expect(result.map(i => i.permlink)).toEqual(['base-0', 'wave-0', 'base-1', 'base-2', 'base-3']);
  });

  it('dedupes extras that repeat a permlink among themselves', () => {
    const dupExtras = [
      { author: 'a', permlink: 'wave-x' },
      { author: 'b', permlink: 'wave-x' },
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

  it('dedupes extras that share a permlink with a base item', () => {
    const b = base(3);
    const dupExtra = { author: 'dup', permlink: 'base-1' };
    const result = promoteToTop(b, [dupExtra, ...extra(1)], { count: 5 });
    expect(result.map(i => i.permlink)).toEqual(['wave-0', 'base-0', 'base-1', 'base-2']);
  });

  it('dedupes extras that repeat a permlink among themselves', () => {
    const dupExtras = [
      { author: 'a', permlink: 'wave-x' },
      { author: 'b', permlink: 'wave-x' },
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
