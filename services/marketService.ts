import { getClient } from './HiveClient';
import { parseFeedPrice, parseOrderBook, type OrderBook } from '../utils/market';

/** Hive's internal market order book (best 100 each side), best price first. */
export async function fetchOrderBook(): Promise<OrderBook> {
    const raw = await getClient().call('condenser_api', 'get_order_book', [100]);
    return parseOrderBook(raw);
}

/** HBD per HIVE from the witness price feed median (what Convert pays out at). */
export async function fetchFeedPrice(): Promise<number> {
    const raw = await getClient().call('condenser_api', 'get_current_median_history_price', []);
    const price = parseFeedPrice(raw);
    if (!price) throw new Error('Could not read the HIVE price feed.');
    return price;
}

/** The chain's head block time, for order expirations. */
export async function fetchHeadTime(): Promise<string> {
    const props = await getClient().database.getDynamicGlobalProperties();
    return String(props.time);
}
