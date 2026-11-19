/**
 * Snap Posting Service
 * Handles posting snaps to the Hive blockchain with beneficiaries for video content
 */

import { Client, PrivateKey, Operation } from '@hiveio/dhive';
import { buildBeneficiaries, snapieShare, type Beneficiary } from '../utils/beneficiaries';

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
  /** Extra beneficiaries chosen by the author (blog posts), merged with @snapie's share. */
  beneficiaries?: Beneficiary[];
  /**
   * @snapie's share in basis points, when the caller has already worked it
   * out (the blog composer shows and validates against it). Overrides the
   * share derived from hasVideo/hasAudio/hasHangout.
   */
  snapieWeight?: number;
}

/**
 * Posts a snap to the Hive blockchain
 * Adds a beneficiary to @snapie when applicable: 10% for video/audio, 3% for hangout announcements,
 * plus any author-chosen beneficiaries (merged, sorted and checked against Hive's limits)
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
  const extra = options.beneficiaries ?? [];

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

  // @snapie: the caller's share if given, else video/audio → 10%, hangout → 3%, otherwise none.
  const snapieWeight =
    options.snapieWeight ?? (hasVideo || hasAudio || hasHangout ? snapieShare(!!(hasVideo || hasAudio)) : 0);

  // No beneficiaries at all: just broadcast the comment
  if (snapieWeight === 0 && extra.length === 0) {
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

  // @snapie's share plus the author's own picks. Throws before
  // broadcasting if Hive would reject the list.
  const beneficiaries = buildBeneficiaries(extra, snapieWeight);

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
