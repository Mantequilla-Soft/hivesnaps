import {
  encodeHiveTransferQR,
  decodeHiveTransferQR,
  currencyFromAmount,
  valueFromAmount,
} from '../hiveQr';

describe('encodeHiveTransferQR / decodeHiveTransferQR', () => {
  it('round-trips a transfer through encode then decode', () => {
    const qr = encodeHiveTransferQR('alice', '1.234 HIVE', 'thanks!');
    expect(qr).toMatch(/^hive:\/\/sign\/op\//);
    expect(decodeHiveTransferQR(qr)).toEqual({
      to: 'alice',
      amount: '1.234 HIVE',
      memo: 'thanks!',
    });
  });

  it('round-trips with an empty memo', () => {
    const qr = encodeHiveTransferQR('bob', '0.500 HBD', '');
    expect(decodeHiveTransferQR(qr)).toEqual({ to: 'bob', amount: '0.500 HBD', memo: '' });
  });

  it('produces a URL-safe base64 payload with no padding', () => {
    const qr = encodeHiveTransferQR('carol', '10.000 HIVE', 'a memo with spaces & stuff');
    const payload = qr.slice('hive://sign/op/'.length);
    expect(payload).not.toMatch(/[+/=]/);
  });

  it('returns null for a string with the wrong prefix', () => {
    expect(decodeHiveTransferQR('not-a-hive-uri')).toBeNull();
    expect(decodeHiveTransferQR('https://example.com')).toBeNull();
  });

  it('returns null for a well-formed prefix but garbage payload', () => {
    expect(decodeHiveTransferQR('hive://sign/op/!!!not-base64!!!')).toBeNull();
  });

  it('returns null when the decoded op is not a transfer', () => {
    const op = JSON.stringify(['vote', { voter: 'alice', author: 'bob', permlink: 'x', weight: 10000 }]);
    const b64 = btoa(op).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeHiveTransferQR(`hive://sign/op/${b64}`)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const op = JSON.stringify(['transfer', { memo: 'no to or amount' }]);
    const b64 = btoa(op).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeHiveTransferQR(`hive://sign/op/${b64}`)).toBeNull();
  });
});

describe('currencyFromAmount', () => {
  it('detects HBD case-insensitively', () => {
    expect(currencyFromAmount('1.000 HBD')).toBe('HBD');
    expect(currencyFromAmount('1.000 hbd')).toBe('HBD');
  });

  it('defaults to HIVE for anything else', () => {
    expect(currencyFromAmount('1.000 HIVE')).toBe('HIVE');
    expect(currencyFromAmount('')).toBe('HIVE');
  });
});

describe('valueFromAmount', () => {
  it('parses the numeric portion', () => {
    expect(valueFromAmount('1.234 HIVE')).toBe(1.234);
    expect(valueFromAmount('0.500 HBD')).toBe(0.5);
  });

  it('returns 0 for an unparseable string', () => {
    expect(valueFromAmount('not a number')).toBe(0);
  });
});
