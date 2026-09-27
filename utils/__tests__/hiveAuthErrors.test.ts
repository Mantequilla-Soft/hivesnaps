import {
  isAuthorityMismatchError,
  onAuthorityMismatch,
  emitAuthorityMismatch,
} from '../hiveAuthErrors';

describe('isAuthorityMismatchError', () => {
  it('matches known hived authority-mismatch phrasings', () => {
    const messages = [
      'missing required posting authority',
      'Missing Posting Authority',
      'missing active authority',
      'tx_missing_posting_auth: Missing Posting Authority',
      'tx_missing_active_auth',
      'signature is not valid',
      'Signature is not valid for account',
      'irrelevant signature',
    ];

    for (const message of messages) {
      expect(isAuthorityMismatchError(new Error(message))).toBe(true);
    }
  });

  it('does not match unrelated errors', () => {
    const messages = [
      'Hive node timeout after 8000ms: https://api.hive.blog',
      'Network request failed',
      'insufficient RC',
      'plugin exception: rc_plugin',
    ];

    for (const message of messages) {
      expect(isAuthorityMismatchError(new Error(message))).toBe(false);
    }
  });

  it('returns false for a non-Error / empty value', () => {
    expect(isAuthorityMismatchError(undefined)).toBe(false);
    expect(isAuthorityMismatchError(null)).toBe(false);
    expect(isAuthorityMismatchError('')).toBe(false);
  });
});

describe('onAuthorityMismatch / emitAuthorityMismatch', () => {
  it('notifies subscribed listeners', () => {
    const cb = jest.fn();
    const unsubscribe = onAuthorityMismatch(cb);

    emitAuthorityMismatch();

    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const cb = jest.fn();
    const unsubscribe = onAuthorityMismatch(cb);
    unsubscribe();

    emitAuthorityMismatch();

    expect(cb).not.toHaveBeenCalled();
  });
});
