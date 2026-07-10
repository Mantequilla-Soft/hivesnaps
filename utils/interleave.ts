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

// Like promoteToTop, but for extras that describe real content which may
// already be organically present in base (matched by permlink) — e.g. a
// trending snap that's also recent enough to already be in the chronological
// feed. Rather than silently dropping such an extra (as plain dedupe would),
// its fields are merged onto the matching base item in place via `mergeInto`.
// Only extras with no match in base are promoted to the front, capped at count.
export function promoteToTopOrMerge<T extends Interleavable, E extends Interleavable>(
  base: readonly T[],
  extras: readonly E[],
  { count }: PromoteToTopOptions,
  mergeInto: (baseItem: T, extra: E) => T
): Array<T | E> {
  if (extras.length === 0) {
    return [...base];
  }

  const basePermlinkIndex = new Map<string | undefined, number>();
  base.forEach((item, index) => basePermlinkIndex.set(item.permlink, index));

  const seenExtraPermlinks = new Set<string | undefined>();
  const newExtras: E[] = [];
  const mergesByIndex = new Map<number, E>();

  for (const extra of extras) {
    if (seenExtraPermlinks.has(extra.permlink)) continue;
    seenExtraPermlinks.add(extra.permlink);

    const baseIndex = basePermlinkIndex.get(extra.permlink);
    if (baseIndex !== undefined) {
      mergesByIndex.set(baseIndex, extra);
    } else {
      newExtras.push(extra);
    }
  }

  const merged: T[] = mergesByIndex.size === 0
    ? [...base]
    : base.map((item, index) => {
        const extra = mergesByIndex.get(index);
        return extra ? mergeInto(item, extra) : item;
      });

  if (newExtras.length === 0 || count <= 0) {
    return merged;
  }

  return [...newExtras.slice(0, count), ...merged];
}
