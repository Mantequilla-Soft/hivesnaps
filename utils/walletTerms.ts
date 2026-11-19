/** Plain-language "What is this?" explainers shown next to wallet balances and actions. */

export type WalletTerm =
    | 'hive'
    | 'hbd'
    | 'hp'
    | 'powerUp'
    | 'powerDown'
    | 'savings'
    | 'delegation'
    | 'pendingRewards';

export const WALLET_TERMS: Record<WalletTerm, { title: string; body: string }> = {
    hive: {
        title: 'Liquid HIVE',
        body:
            'HIVE you can spend right away: send it to anyone, power it up, or put it in savings. ' +
            'Its price moves with the market.',
    },
    hbd: {
        title: 'HBD (Hive Backed Dollars)',
        body:
            'A token designed to stay close to 1 US dollar. You can send it like HIVE, and HBD kept in ' +
            'savings earns interest set by the Hive witnesses.',
    },
    hp: {
        title: 'Hive Power (HP)',
        body:
            'HIVE that you have staked. HP gives your votes more weight, earns curation rewards and lets you ' +
            'do more on chain. It can’t be sent, but you can delegate it or power it down back to HIVE over 13 weeks.',
    },
    powerUp: {
        title: 'Power Up',
        body: 'Turns liquid HIVE into Hive Power instantly. 1 HIVE becomes about 1 HP.',
    },
    powerDown: {
        title: 'Power Down',
        body:
            'Turns Hive Power back into liquid HIVE. It pays out in 13 equal weekly parts, and you can stop it at any time.',
    },
    savings: {
        title: 'Savings',
        body:
            'A safe box for HIVE and HBD. Moving money in is instant; taking it out takes 3 days, which gives you time ' +
            'to react if your keys are ever stolen. HBD in savings earns interest; HIVE in savings does not.',
    },
    delegation: {
        title: 'Delegating Hive Power',
        body:
            'Lends some of your HP to another account so they can vote and act with it. You keep ownership and can take it ' +
            'back at any time; returned HP takes 5 days to become usable again.',
    },
    pendingRewards: {
        title: 'Pending rewards',
        body:
            'What you’ve earned from posts, comments and curation that hasn’t been added to your balance yet. ' +
            'Claiming moves it into your wallet.',
    },
};
