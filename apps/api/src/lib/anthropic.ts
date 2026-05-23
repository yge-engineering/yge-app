// Single Anthropic client used by every AI-backed endpoint.
// Server-side only — the API key must never reach the browser.

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
// In dev, we allow missing key so the API can still start (any
// AI-backed route returns 503 with a clear message — see
// pdf-extract.ts for an example of that pattern).
//
// We no longer THROW at module load when the key is missing in prod.
// Throwing here would crash the entire API process on Render boot,
// which means every other route 502s while the operator scrambles to
// add the env var. Per-route 503 with a clear error is friendlier and
// keeps the non-AI surface working.
//
// Logging the omission at startup makes the misconfiguration loud.
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[anthropic] ANTHROPIC_API_KEY is not set — every AI-backed route will return 503 until it is.',
  );
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? 'missing-key-dev',
});

// The current default model. Override per-deploy via env var so we
// can roll forward without a code change when Anthropic ships a new
// minor (e.g. set ANTHROPIC_MODEL=claude-sonnet-4-7 on Render).
//
// The hard-coded fallback is the latest stable family at the time of
// writing. If 'claude-sonnet-4-6' was actually a typo / sunset
// model, that was the source of the PDF-drop failure the user saw
// — pdf-extract.ts now surfaces the real Anthropic error so it's
// obvious which way to flip.
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
