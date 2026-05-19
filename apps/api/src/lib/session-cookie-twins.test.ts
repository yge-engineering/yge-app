// Guard against drift between the two session-cookie.ts copies.
//
// Plain English: signSession / verifySession lives in apps/api/src/lib AND
// apps/web/src/lib because both halves of the app need it as a sync helper
// (node:crypto can't go in packages/shared because the browser-extension
// build can't tolerate it). They MUST stay byte-identical or signed cookies
// won't round-trip. This test reads both files at runtime and asserts they
// match. CI fails noisily when someone edits one and forgets the other.

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('session-cookie twins stay in sync', () => {
  test('apps/api and apps/web copies are byte-identical', () => {
    const apiCopy = readFileSync(
      resolve(__dirname, 'session-cookie.ts'),
      'utf8',
    );
    const webCopy = readFileSync(
      resolve(
        __dirname,
        '../../../web/src/lib/session-cookie.ts',
      ),
      'utf8',
    );
    if (apiCopy !== webCopy) {
      const apiLen = apiCopy.length;
      const webLen = webCopy.length;
      throw new Error(
        `apps/api/src/lib/session-cookie.ts (${apiLen} bytes) and ` +
          `apps/web/src/lib/session-cookie.ts (${webLen} bytes) diverged. ` +
          'Copy one over the other and re-run the test.',
      );
    }
    expect(apiCopy).toEqual(webCopy);
  });
});
