import { PrivateKey, type Operation } from '@hiveio/dhive';
import { getClient } from './HiveClient';
import { accountStorageService } from './AccountStorageService';
import {
    buildPostingJsonMetadata,
    changedProfileFields,
    cleanProfileFields,
    profileFieldsError,
    readProfileFields,
    type ProfileFields,
} from '../utils/profileMetadata';

/** The account's editable profile fields, read fresh from chain. */
export async function fetchProfileFields(username: string): Promise<ProfileFields> {
    const [account] = await getClient().database.getAccounts([username]);
    if (!account) throw new Error('Account not found.');
    return readProfileFields(account);
}

/**
 * Save profile fields with account_update2, signed with the stored posting
 * key. Only posting_json_metadata changes (an empty json_metadata leaves
 * that field alone, which is what lets the posting key authorize it), and
 * it's rebuilt from the account's current on-chain value right before
 * broadcasting, so keys other apps keep there survive. With `baseline`
 * (the fields as the editor loaded them), only the fields that differ from
 * it are written, so a field another app changed meanwhile isn't reverted.
 * Returns the profile fields as they now are on chain (edits trimmed,
 * website normalized).
 */
export async function saveProfileFields(
    username: string,
    fields: ProfileFields,
    baseline?: ProfileFields
): Promise<ProfileFields> {
    const problem = profileFieldsError(fields);
    if (problem) throw new Error(problem);
    const patch = baseline ? changedProfileFields(baseline, fields) : cleanProfileFields(fields);

    const postingKeyStr = await accountStorageService.getCurrentPostingKey();
    if (!postingKeyStr) throw new Error('No posting key found. Please log in again.');
    const postingKey = PrivateKey.fromString(postingKeyStr);

    const client = getClient();
    const [account] = await client.database.getAccounts([username]);
    if (!account) throw new Error('Account not found.');

    const op: Operation = [
        'account_update2',
        {
            account: username,
            json_metadata: '',
            posting_json_metadata: buildPostingJsonMetadata(account, patch),
            extensions: [],
        },
    ];
    await client.broadcast.sendOperations([op], postingKey);
    return { ...readProfileFields(account), ...patch };
}

// Set when a profile is saved, so the profile screen re-reads it once on
// returning to focus (rather than on every focus).
const savedProfiles = new Set<string>();

export function markProfileSaved(username: string): void {
    savedProfiles.add(username);
}

/** True once after markProfileSaved(username). */
export function consumeProfileSaved(username: string): boolean {
    return savedProfiles.delete(username);
}
