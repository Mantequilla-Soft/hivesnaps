// Splices extra items into a base list, deduping by `permlink`.

export interface Interleavable {
  author: string;
  permlink?: string;
}

// Extras that already appear in base (or repeat among themselves) are dropped,
// preserving the order extras were given in.
function dedupeExtras<T extends Interleavable, E extends Interleavable>(
  base: readonly T[],
  extras: readonly E[]
): E[] {
  const basePermlinks = new Set(base.map(item => item.permlink));
  const usedExtraPermlinks = new Set<string | undefined>();
  return extras.filter(extra => {
    if (basePermlinks.has(extra.permlink)) return false;
    if (usedExtraPermlinks.has(extra.permlink)) return false;
    usedExtraPermlinks.add(extra.permlink);
    return true;
  });
}

export interface InterleaveOptions {
  /** Insert one extra item after every N base items. */
  every: number;
}

// Spreads extras evenly throughout base, stopping once extras run out (never cycles back).
export function interleave<T extends Interleavable, E extends Interleavable>(
  base: readonly T[],
  extras: readonly E[],
  { every }: InterleaveOptions
): Array<T | E> {
  if (extras.length === 0 || every <= 0) {
    return [...base];
  }

  const availableExtras = dedupeExtras(base, extras);
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

export interface PromoteToTopOptions {
  /** Max number of extras to place at the very front of the list. */
  count: number;
}

// Prepends up to `count` extras to the very front of base, leaving base's
// own order untouched otherwise — for surfacing a fixed "shelf" of promoted
// content (e.g. trending) rather than spreading it throughout the scroll.
export function promoteToTop<T extends Interleavable, E extends Interleavable>(
  base: readonly T[],
  extras: readonly E[],
  { count }: PromoteToTopOptions
): Array<T | E> {
  if (extras.length === 0 || count <= 0) {
    return [...base];
  }

  const availableExtras = dedupeExtras(base, extras).slice(0, count);
  return [...availableExtras, ...base];
}
