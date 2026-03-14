import { useState, useEffect } from 'react';
import { getClient } from '../services/HiveClient';

const client = getClient();

export const useHiveData = () => {
  const [medianPrice, setMedianPrice] = useState(0);
  const [globalProps, setGlobalProps] = useState<any>(null);
  const [rewardFund, setRewardFund] = useState<any>(null);

  // Initialize reward fund and median price
  useEffect(() => {
    const initializeUpvoteData = async () => {
      try {
        // Fetch reward fund
        const fund = await client.database.call('get_reward_fund', ['post']);
        setRewardFund(fund);

        // Fetch global props
        const props = await client.database.getDynamicGlobalProperties();
        setGlobalProps(props);

        // Fetch median price from the blockchain (same source all frontends use)
        const priceData = await client.database.call(
          'get_current_median_history_price',
          []
        );
        // priceData = { base: "0.063 HBD", quote: "1.000 HIVE" }
        const base = parseFloat(priceData.base);
        const quote = parseFloat(priceData.quote);
        if (quote > 0) {
          setMedianPrice(base / quote);
        }
      } catch (error) {
        console.log('Error initializing upvote data:', error);
      }
    };
    initializeUpvoteData();
  }, []);

  return {
    medianPrice,
    globalProps,
    rewardFund,
  };
};
