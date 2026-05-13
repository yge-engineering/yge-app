// Next.js throws specific Error subclasses as control-flow signals.
// User code MUST re-throw these — catching them breaks redirect(),
// notFound(), dynamic rendering, and other framework features.

const NEXT_INTERNAL_DIGESTS = new Set([
  'DYNAMIC_SERVER_USAGE',
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'NEXT_HTTP_ERROR_FALLBACK',
]);

/** Returns true if `err` is one of Next.js's control-flow signals. */
export function isNextInternalError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const digest = (err as { digest?: string }).digest;
  if (typeof digest !== 'string') return false;
  if (NEXT_INTERNAL_DIGESTS.has(digest)) return true;
  if (digest.startsWith('NEXT_REDIRECT')) return true;
  if (digest.startsWith('NEXT_NOT_FOUND')) return true;
  if (digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')) return true;
  return false;
}
