// Tests for the HMAC-signed session-cookie helpers.

import { describe, expect, test } from 'vitest';
import { signSession, verifySession } from './session-cookie';

interface User {
  email: string;
  name: string;
  role: string;
}

const sampleUser: User = {
  email: 'ryoung@youngge.com',
  name: 'Ryan D. Young',
  role: 'VP',
};

const SECRET = 'test-secret-XXXXXXXXXXXXXXXXXXXX';

describe('signSession + verifySession round-trip (signed)', () => {
  test('a signed payload verifies back', () => {
    const cookie = signSession(sampleUser, SECRET);
    expect(cookie.startsWith('s1.')).toBe(true);
    const result = verifySession<User>(cookie, SECRET);
    expect(result.valid).toBe(true);
    expect(result.signed).toBe(true);
    expect(result.payload).toEqual(sampleUser);
  });

  test('tampered body fails verification', () => {
    const cookie = signSession(sampleUser, SECRET);
    // Swap one character in the base64url-encoded body half.
    const idx = cookie.indexOf('.');
    const swapped = cookie.slice(0, idx).replace(/[A-Za-z]/, 'X') + cookie.slice(idx);
    const result = verifySession<User>(swapped, SECRET);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
  });

  test('tampered signature fails verification', () => {
    const cookie = signSession(sampleUser, SECRET);
    // Replace one char in the signature half. (Truncating just the
    // last char could land on a valid b64-rounding equivalent.)
    const lastDot = cookie.lastIndexOf('.');
    const broken =
      cookie.slice(0, lastDot + 1) +
      cookie.slice(lastDot + 1).replace(/^[A-Za-z]/, (c) =>
        c === 'A' ? 'B' : 'A',
      );
    const result = verifySession<User>(broken, SECRET);
    expect(result.valid).toBe(false);
    expect(result.signed).toBe(false);
  });

  test('different secret fails verification', () => {
    const cookie = signSession(sampleUser, SECRET);
    const result = verifySession<User>(cookie, 'different-secret');
    expect(result.valid).toBe(false);
  });
});

describe('legacy unsigned format (empty secret)', () => {
  test('empty secret produces URL-encoded JSON without the s1. prefix', () => {
    const cookie = signSession(sampleUser, '');
    expect(cookie.startsWith('s1.')).toBe(false);
    expect(decodeURIComponent(cookie)).toEqual(JSON.stringify(sampleUser));
  });

  test('legacy cookie verifies but reports signed=false', () => {
    const cookie = signSession(sampleUser, '');
    const result = verifySession<User>(cookie, '');
    expect(result.valid).toBe(true);
    expect(result.signed).toBe(false);
    expect(result.payload).toEqual(sampleUser);
  });

  test('legacy cookie also accepts when secret is set (backward compat)', () => {
    const cookie = signSession(sampleUser, '');
    // Operator deploys YGE_SESSION_SECRET but existing browser sessions
    // still have legacy cookies. We should accept them but flag signed=false.
    const result = verifySession<User>(cookie, SECRET);
    expect(result.valid).toBe(true);
    expect(result.signed).toBe(false);
  });
});

describe('edge cases', () => {
  test('empty string returns invalid', () => {
    const result = verifySession<User>('', SECRET);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
  });

  test('garbage returns invalid', () => {
    const result = verifySession<User>('this-is-not-a-cookie', SECRET);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
  });

  test('payload with null is treated as invalid', () => {
    // signSession(null, secret) encodes JSON "null"
    const cookie = signSession(null, SECRET);
    const result = verifySession<User>(cookie, SECRET);
    // Signature passes but payload is null → valid=false
    expect(result.signed).toBe(true);
    expect(result.valid).toBe(false);
  });

  test('special characters survive round-trip', () => {
    const tricky = {
      email: 'ryo+test@youngge.com',
      name: 'Ryän "Test" Young',
      role: 'VP',
    };
    const cookie = signSession(tricky, SECRET);
    const result = verifySession<typeof tricky>(cookie, SECRET);
    expect(result.payload).toEqual(tricky);
  });
});
