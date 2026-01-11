/**
 * Snap Posting Service
 * Handles posting snaps to the Hive blockchain with beneficiaries for video content
 */

import { Client, PrivateKey, Operation } from '@hiveio/dhive';

interface PostSnapOptions {
  parentAuthor: string;
  parentPermlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  jsonMetadata: string;
  hasVideo: boolean; // Determines if beneficiaries should be added
  hasAudio?: boolean; // Determines if beneficiaries should be added for audio
}

/**
 * Posts a snap to the Hive blockchain
 * If the snap contains a video or audio, adds a 10% beneficiary to @snapie
 *
 * @param client - Hive blockchain client
 * @param options - Posting options
 * @param postingKey - User's posting key (PrivateKey)
 * @returns Transaction ID
 */
export async function postSnapWithBeneficiaries(
  client: Client,
  options: PostSnapOptions,
  postingKey: PrivateKey
): Promise<string> {
  const { parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata, hasVideo, hasAudio } =
    options;

  // Base comment operation
  const commentOp: Operation = [
    'comment',
    {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author: author,
      permlink: permlink,
      title: title,
      body: body,
      json_metadata: jsonMetadata,
    },
  ];

  // If no video or audio, just broadcast the comment
  if (!hasVideo && !hasAudio) {
    const result = await client.broadcast.comment(
      {
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        author: author,
        permlink: permlink,
        title: title,
        body: body,
        json_metadata: jsonMetadata,
      },
      postingKey
    );
    return result.id || 'unknown';
  }

  // If there's a video or audio, add comment_options with beneficiaries
  const beneficiaries = [
    {
      account: 'snapie',
      weight: 1000, // 10% (1000 = 10% of 10000)
    },
  ];

  const commentOptionsOp: Operation = [
    'comment_options',
    {
      author: author,
      permlink: permlink,
      max_accepted_payout: '1000000.000 HBD',
      percent_hbd: 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: [
        [
          0,
          {
            beneficiaries,
          },
        ],
      ],
    },
  ];

  // Broadcast both operations together in a single transaction
  const result = await client.broadcast.sendOperations(
    [commentOp, commentOptionsOp] as Operation[],
    postingKey
  );

  return result.id || 'unknown';
}
