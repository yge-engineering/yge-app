// Login rate limiter — in-memory bucket per (IP, email) to slow down
// brute-force password guessing.
//
// Plain English: track failed sign-in attempts. After N failures in
// a window, the next attempt returns 429 with a Retry-After hint.
// Successful sign-ins reset the bucket. The store is in-process —
// good enough for a single-instance Render Standard service. When
// we go multi-instance this moves to Redis.

interface Bucket {
  failures: number;
  firstFailureAt: number;
}

const MAX_FAILURES = Number.parseInt(
  process.env.LOGIN_MAX_FAILURES ?? '8',
  10,
);
const WINDOW_MS = Number.parseInt(
  process.env.LOGIN_WINDOW_MS ?? `${15 * 60_000}`,
  10,
);
const LOCKOUT_MS = Number.parseInt(
  process.env.LOGIN_LOCKOUT_MS ?? `${15 * 60_000}`,
  10,
);

const buckets = new Map<string, Bucket>();

function key(ip: string, email: string): string {
  return `${ip || 'unknown'}|${email.trim().toLowerCase()}`;
}

function prune(now: number): void {
  // Lightweight GC: drop any bucket whose window has fully expired.
  for (const [k, b] of buckets) {
    if (now - b.firstFailureAt > Math.max(WINDOW_MS, LOCKOUT_MS)) {
      buckets.delete(k);
    }
  }
}

/** Returns null if the (ip, email) is allowed to attempt sign-in.
 *  Returns { retryAfterMs } if currently locked out. */
export function checkLoginAllowed(
  ip: string,
  email: string,
): null | { retryAfterMs: number } {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key(ip, email));
  if (!b) return null;
  // Window expired — reset.
  if (now - b.firstFailureAt > WINDOW_MS) {
    buckets.delete(key(ip, email));
    return null;
  }
  if (b.failures >= MAX_FAILURES) {
    const elapsed = now - b.firstFailureAt;
    if (elapsed < LOCKOUT_MS) {
      return { retryAfterMs: LOCKOUT_MS - elapsed };
    }
    // Lockout window passed — give them a fresh chance.
    buckets.delete(key(ip, email));
    return null;
  }
  return null;
}

export function recordLoginFailure(ip: string, email: string): void {
  const now = Date.now();
  const k = key(ip, email);
  const existing = buckets.get(k);
  if (!existing) {
    buckets.set(k, { failures: 1, firstFailureAt: now });
    return;
  }
  // Reset on a fresh window.
  if (now - existing.firstFailureAt > WINDOW_MS) {
    buckets.set(k, { failures: 1, firstFailureAt: now });
    return;
  }
  existing.failures += 1;
}

export function recordLoginSuccess(ip: string, email: string): void {
  buckets.delete(key(ip, email));
}

/** Visible config for /health/integrations or admin debugging. */
export function getLoginRateLimitConfig() {
  return {
    maxFailures: MAX_FAILURES,
    windowMs: WINDOW_MS,
    lockoutMs: LOCKOUT_MS,
    activeBuckets: buckets.size,
  };
}
