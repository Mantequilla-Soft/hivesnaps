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
  hasHangout?: boolean; // Adds 3% beneficiary to @snapie for hangout announcements
}

/**
 * Posts a snap to the Hive blockchain
 * Adds a beneficiary to @snapie when applicable: 10% for video/audio, 3% for hangout announcements
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
  const { parentAuthor, parentPermlink, author, permlink, title, body, jsonMetadata, hasVideo, hasAudio, hasHangout } =
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

  // If no video, audio, or hangout, just broadcast the comment
  if (!hasVideo && !hasAudio && !hasHangout) {
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

  // video/audio → 10%, hangout → 3%
  const weight = hasVideo || hasAudio ? 1000 : 300;
  const beneficiaries = [
    {
      account: 'snapie',
      weight,
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
