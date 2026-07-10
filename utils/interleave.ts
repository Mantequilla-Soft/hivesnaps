// Splices extra items into a base list at a fixed cadence, deduping by
// `permlink` and stopping once the extras run out (never cycles back).

export interface Interleavable {
  author: string;
  permlink?: string;
}

export interface InterleaveOptions {
  /** Insert one extra item after every N base items. */
  every: number;
}

export function interleave<T extends Interleavable, E extends Interleavable>(
  base: readonly T[],
  extras: readonly E[],
  { every }: InterleaveOptions
): Array<T | E> {
  if (extras.length === 0 || every <= 0) {
    return [...base];
  }

  const basePermlinks = new Set(base.map(item => item.permlink));
  const usedExtraPermlinks = new Set<string | undefined>();
  const availableExtras = extras.filter(extra => {
    if (basePermlinks.has(extra.permlink)) return false;
    if (usedExtraPermlinks.has(extra.permlink)) return false;
    usedExtraPermlinks.add(extra.permlink);
    return true;
  });

  if (availableExtras.length === 0) {
    return [...base];
  }

  const result: Array<T | E> = [];
  let nextExtraIndex = 0;

  base.forEach((item, index) => {
    result.push(item);
    const isInsertionPoint = (index + 1) % every === 0;
    if (isInsertionPoint && nextExtraIndex < availableExtras.length) {
      result.push(availableExtras[nextExtraIndex]);
      nextExtraIndex += 1;
    }
  });

  return result;
}
