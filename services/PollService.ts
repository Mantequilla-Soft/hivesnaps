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
  const url = `${HIVEHUB_API}?author=${encodeURIComponent(author)}&permlink=${encodeURIComponent(permlink)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Poll results fetch failed: ${response.status}`);
  }
  const data = await response.json();
  return data as PollResults;
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
