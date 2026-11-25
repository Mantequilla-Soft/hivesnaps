/**
 * HIVE ⇄ HBD on Hive's internal market (Swap) and HBD → HIVE conversion
 * (Convert), as in snapie.io's wallet. Amounts are in whole units (3 decimals).
 */

export type SwapDirection = 'HIVE_TO_HBD' | 'HBD_TO_HIVE';

/** One resting order: how much HIVE / HBD it trades, and its HBD-per-HIVE price. */
export interface BookLevel {
    hive: number;
    hbd: number;
    price: number;
}

export interface OrderBook {
    /** Buy HIVE with HBD, best (highest) price first. Selling HIVE fills these. */
    bids: BookLevel[];
    /** Sell HIVE for HBD, best (lowest) price first. Selling HBD fills these. */
    asks: BookLevel[];
}

const round3 = (n: number): number => Math.floor(n * 1000 + 1e-6) / 1000;

function parseLevels(raw: unknown): BookLevel[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((o): BookLevel[] => {
        const hive = Number((o as { hive?: unknown })?.hive) / 1000;
        const hbd = Number((o as { hbd?: unknown })?.hbd) / 1000;
        if (!(hive > 0 && hbd > 0 && Number.isFinite(hive) && Number.isFinite(hbd))) return [];
        // real_price (HBD per HIVE on both sides) is the order's exact price;
        // hbd/hive is computed from amounts the chain has rounded.
        const real = Number((o as { real_price?: unknown })?.real_price);
        return [{ hive, hbd, price: real > 0 && Number.isFinite(real) ? real : hbd / hive }];
    });
}

/** condenser_api.get_order_book → bids/asks sorted best-first. */
export function parseOrderBook(raw: unknown): OrderBook {
    const r = (raw ?? {}) as { bids?: unknown; asks?: unknown };
    return {
        bids: parseLevels(r.bids).sort((a, b) => b.price - a.price),
        asks: parseLevels(r.asks).sort((a, b) => a.price - b.price),
    };
}

export interface SwapQuote {
    /** What you'd receive if it filled now, walking the book from the best price (rounded down to 3 decimals). */
    receive: number;
    /** Same, unrounded: use this for the minimum, so it isn't rounded down twice. */
    exactReceive: number;
    /** HBD per HIVE, averaged over the fill. */
    averagePrice: number;
    /** The book has enough on the other side for the whole amount. */
    fillable: boolean;
}

/** What selling `amount` (HIVE or HBD, per direction) gets right now. */
export function quoteSwap(book: OrderBook, direction: SwapDirection, amount: number): SwapQuote {
    let remaining = amount;
    let receive = 0;
    const levels = direction === 'HIVE_TO_HBD' ? book.bids : book.asks;
    for (const level of levels) {
        if (remaining <= 0) break;
        if (direction === 'HIVE_TO_HBD') {
            const sell = Math.min(remaining, level.hive);
            receive += sell * level.price;
            remaining -= sell;
        } else {
            const sell = Math.min(remaining, level.hbd);
            receive += sell / level.price;
            remaining -= sell;
        }
    }
    const filled = amount - Math.max(remaining, 0);
    const averagePrice =
        filled > 0 ? (direction === 'HIVE_TO_HBD' ? receive / filled : filled / receive) : 0;
    return { receive: round3(receive), exactReceive: receive, averagePrice, fillable: remaining <= 1e-9 && receive > 0 };
}

/**
 * The least you'll accept: the exact quote minus the slippage you allow,
 * rounded down once (pass SwapQuote.exactReceive, not the rounded receive).
 */
export function minReceive(exactReceive: number, slippagePercent: number): number {
    return round3(exactReceive * (1 - slippagePercent / 100));
}

export const SLIPPAGE_CHOICES = [0.5, 1, 2] as const;

/** A random uint32 order id. */
export function newOrderId(): number {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * A fill-or-kill order: it fills completely at `min` or better right away,
 * or nothing happens (no order is left on the book).
 */
export function swapOperation(
    owner: string,
    direction: SwapDirection,
    amount: number,
    min: number,
    orderId: number,
    expiration: string
): [string, Record<string, unknown>] {
    const sell = direction === 'HIVE_TO_HBD' ? 'HIVE' : 'HBD';
    const get = direction === 'HIVE_TO_HBD' ? 'HBD' : 'HIVE';
    return [
        'limit_order_create',
        {
            owner,
            orderid: orderId,
            amount_to_sell: `${amount.toFixed(3)} ${sell}`,
            min_to_receive: `${min.toFixed(3)} ${get}`,
            fill_or_kill: true,
            expiration,
        },
    ];
}

/** Chain head time ("2026-11-25T00:00:00", UTC, no Z) plus minutes, in the same format. */
export function expirationFrom(headTime: string, minutes = 5): string {
    const ms = Date.parse(`${headTime.replace(/Z$/, '')}Z`);
    if (!Number.isFinite(ms)) throw new Error('Could not read the chain time.');
    return new Date(ms + minutes * 60_000).toISOString().split('.')[0];
}

/** HBD → HIVE conversion: pays out in 3.5 days at the median price feed of that period. */
export function convertOperation(owner: string, amountHbd: number, requestId: number): [string, Record<string, unknown>] {
    return ['convert', { owner, requestid: requestId, amount: `${amountHbd.toFixed(3)} HBD` }];
}

/** HBD per HIVE from get_current_median_history_price ({ base: "0.034 HBD", quote: "1.000 HIVE" }). */
export function parseFeedPrice(raw: unknown): number | null {
    const r = (raw ?? {}) as { base?: unknown; quote?: unknown };
    const base = parseFloat(String(r.base ?? ''));
    const quote = parseFloat(String(r.quote ?? ''));
    return base > 0 && quote > 0 ? base / quote : null;
}
