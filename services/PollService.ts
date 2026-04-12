import { PrivateKey } from '@hiveio/dhive';
import { getClient } from './HiveClient';

export interface PollChoiceVotes {
  total_votes: number;
  hive_hp: number;
  hive_hp_incl_proxied: number;
}

export interface PollChoiceResult {
  choice_num: number;   // 1-based
  choice_text: string;
  votes: PollChoiceVotes | null;
}

export interface PollVoter {
  name: string;         // username
  choices: number[];    // 1-based choice numbers
  hive_hp: number;
  hive_hp_incl_proxied: number;
}

export interface PollStats {
  total_voting_accounts_num: number;
  total_hive_hp: number;
  total_hive_hp_incl_proxied: number;
}

export interface PollResults {
  poll_choices: PollChoiceResult[];
  poll_voters: PollVoter[] | null;
  poll_stats: PollStats | null;
}

const HIVEHUB_API = 'https://polls.hivehub.dev/rpc/poll';

export async function fetchPollResults(author: string, permlink: string): Promise<PollResults | null> {
  // hivehub.dev is PostgREST — filter syntax is field=eq.value
  const url = `${HIVEHUB_API}?author=eq.${encodeURIComponent(author)}&permlink=eq.${encodeURIComponent(permlink)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Poll results fetch failed: ${response.status}`);
  }
  const data = await response.json();
  // PostgREST returns an array; take first element
  const result = Array.isArray(data) ? data[0] : data;
  return result ?? null;
}

export async function votePoll(
  voter: string,
  author: string,
  permlink: string,
  choices: number[],
  postingKeyStr: string
): Promise<void> {
  const client = getClient();
  const postingKey = PrivateKey.fromString(postingKeyStr.trim());

  await client.broadcast.json(
    {
      required_auths: [],
      required_posting_auths: [voter],
      id: 'polls',
      json: JSON.stringify({ voter, author, permlink, choices }),
    },
    postingKey
  );
}
