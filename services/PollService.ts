import { PrivateKey } from '@hiveio/dhive';
import { getClient } from './HiveClient';

export interface PollChoiceResult {
  choice_num: number;
  votes: number;
  hive_hp_incl_proxied?: number;
}

export interface PollVoter {
  voter: string;
  choices: number[];
}

export interface PollResults {
  total_votes: number;
  choices: PollChoiceResult[];
  voters?: PollVoter[];
}

const HIVEHUB_API = 'https://polls.hivehub.dev/rpc/poll';

export async function fetchPollResults(author: string, permlink: string): Promise<PollResults> {
  // hivehub.dev uses PostgREST filter syntax: field=eq.value
  const url = `${HIVEHUB_API}?author=eq.${encodeURIComponent(author)}&permlink=eq.${encodeURIComponent(permlink)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Poll results fetch failed: ${response.status}`);
  }
  const data = await response.json();
  // PostgREST returns an array; take first element
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return { total_votes: 0, choices: [], voters: [] };
  }
  return result as PollResults;
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
