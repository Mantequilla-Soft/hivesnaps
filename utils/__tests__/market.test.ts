import {
    convertOperation,
    expirationFrom,
    minReceive,
    newOrderId,
    parseFeedPrice,
    parseOrderBook,
    quoteSwap,
    swapOperation,
} from '../market';

// Shape of condenser_api.get_order_book (amounts in thousandths).
const rawBook = {
    bids: [
        { hive: 100000, hbd: 3500 }, // 100 HIVE at 0.035
        { hive: 200000, hbd: 6800 }, // 200 HIVE at 0.034
        { hive: 0, hbd: 1 },         // junk
    ],
    asks: [
        { hive: 50000, hbd: 1850 },  // 50 HIVE at 0.037
        { hive: 100000, hbd: 3600 }, // 100 HIVE at 0.036 (better, should sort first)
    ],
};

describe('parseOrderBook', () => {
    it('converts thousandths, drops junk, and sorts best first', () => {
        const book = parseOrderBook(rawBook);
        const close = (xs: number[]) => xs.map((x) => Number(x.toFixed(6)));
        expect(close(book.bids.map((l) => l.price))).toEqual([0.035, 0.034]);
        expect(close(book.asks.map((l) => l.price))).toEqual([0.036, 0.037]);
        expect(book.bids[0]).toEqual({ hive: 100, hbd: 3.5, price: 0.035 });
    });

    it('prefers the exact real_price over the rounded amounts', () => {
        const book = parseOrderBook({ bids: [{ hive: 5365, hbd: 194, real_price: '0.03616' }], asks: [] });
        expect(book.bids[0].price).toBe(0.03616);
    });

    it('tolerates garbage', () => {
        expect(parseOrderBook(null)).toEqual({ bids: [], asks: [] });
        expect(parseOrderBook({ bids: 'x' })).toEqual({ bids: [], asks: [] });
    });
});

describe('quoteSwap', () => {
    const book = parseOrderBook(rawBook);

    it('sells HIVE into bids, walking down the book', () => {
        expect(quoteSwap(book, 'HIVE_TO_HBD', 50)).toEqual(expect.objectContaining({ receive: 1.75, averagePrice: 0.035, fillable: true }));
        const deep = quoteSwap(book, 'HIVE_TO_HBD', 150); // 100 @0.035 + 50 @0.034
        expect(deep.receive).toBe(5.2);
        expect(deep.averagePrice).toBeCloseTo(5.2 / 150, 6);
        expect(deep.fillable).toBe(true);
    });

    it('sells HBD into asks', () => {
        const q = quoteSwap(book, 'HBD_TO_HIVE', 3.6); // all of the 0.036 ask
        expect(q.receive).toBe(100);
        expect(q.averagePrice).toBeCloseTo(0.036, 6);
        const deeper = quoteSwap(book, 'HBD_TO_HIVE', 3.6 + 0.925); // + half of the 0.037 ask
        expect(deeper.receive).toBe(125);
    });

    it('is not fillable when the book is too thin', () => {
        const q = quoteSwap(book, 'HIVE_TO_HBD', 1000);
        expect(q.fillable).toBe(false);
        expect(q.receive).toBe(10.3); // everything there is
        expect(quoteSwap({ bids: [], asks: [] }, 'HIVE_TO_HBD', 1).fillable).toBe(false);
    });
});

it('the minimum comes from the exact quote, so small swaps aren\'t rounded down twice', () => {
    // 0.131 HIVE at 0.0359 → 0.0047029 HBD: rounded quote 0.004, but 1% off the exact value is still 0.004.
    const q = quoteSwap({ bids: [{ hive: 1000, hbd: 35.9, price: 0.0359 }], asks: [] }, 'HIVE_TO_HBD', 0.131);
    expect(q.receive).toBe(0.004);
    expect(minReceive(q.exactReceive, 1)).toBe(0.004);
    expect(minReceive(q.receive, 1)).toBe(0.003); // what using the rounded value would have done
});

it('minReceive takes the slippage off and rounds down to 3 decimals', () => {
    expect(minReceive(10, 1)).toBe(9.9);
    expect(minReceive(5.2, 0.5)).toBe(5.174);
    expect(minReceive(0.0015, 1)).toBe(0.001);
});

it('builds a fill-or-kill order with chain-format amounts', () => {
    expect(swapOperation('meno', 'HIVE_TO_HBD', 50, 1.732, 42, '2026-11-25T00:10:00')).toEqual([
        'limit_order_create',
        {
            owner: 'meno',
            orderid: 42,
            amount_to_sell: '50.000 HIVE',
            min_to_receive: '1.732 HBD',
            fill_or_kill: true,
            expiration: '2026-11-25T00:10:00',
        },
    ]);
    expect(swapOperation('meno', 'HBD_TO_HIVE', 3.6, 99, 1, 'x')[1]).toEqual(
        expect.objectContaining({ amount_to_sell: '3.600 HBD', min_to_receive: '99.000 HIVE' })
    );
});

it('builds a convert operation', () => {
    expect(convertOperation('meno', 12.5, 7)).toEqual(['convert', { owner: 'meno', requestid: 7, amount: '12.500 HBD' }]);
});

it('expiration is chain time plus minutes, in chain format', () => {
    expect(expirationFrom('2026-11-25T00:00:00', 10)).toBe('2026-11-25T00:10:00');
    expect(() => expirationFrom('nope')).toThrow(/chain time/);
});

it('order ids are uint32', () => {
    for (let i = 0; i < 50; i++) {
        const id = newOrderId();
        expect(Number.isInteger(id) && id >= 0 && id <= 0xffffffff).toBe(true);
    }
});

it('parses the median price feed', () => {
    expect(parseFeedPrice({ base: '0.034 HBD', quote: '1.000 HIVE' })).toBeCloseTo(0.034, 6);
    expect(parseFeedPrice({ base: '0.000 HBD', quote: '1.000 HIVE' })).toBeNull();
    expect(parseFeedPrice(null)).toBeNull();
});
