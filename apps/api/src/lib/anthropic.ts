// Single Anthropic client used by every AI-backed endpoint.
// Server-side only — the API key must never reach the browser.

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && process.env.NODE_ENV === 'production') {
  // In dev, we allow missing key so the API can still start.
  throw new Error('ANTHROPIC_API_KEY is required in production.');
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? 'missing-key-dev',
});

// The current default model. Upgrade here in one place.
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
