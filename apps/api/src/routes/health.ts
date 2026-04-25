import { Router } from 'express';
import { prisma } from '@yge/db';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', at: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', at: new Date().toISOString() });
  }
});

// GET /health/anthropic — confirms the ANTHROPIC_API_KEY is set and reachable
// without spending a meaningful number of tokens. Sends a 1-token "ping"
// message and reports back. Use this from the dev shell to debug AI failures
// before assuming the prompt is broken.
healthRouter.get('/anthropic', async (_req, res) => {
  const at = new Date().toISOString();
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      status: 'degraded',
      reason: 'ANTHROPIC_API_KEY is not set in apps/api/.env',
      at,
    });
  }

  try {
    const start = Date.now();
    const resp = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    });
    const ms = Date.now() - start;
    return res.json({
      status: 'ok',
      model: DEFAULT_MODEL,
      latencyMs: ms,
      stopReason: resp.stop_reason,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
      at,
    });
  } catch (err) {
    return res.status(503).json({
      status: 'degraded',
      reason: err instanceof Error ? err.message : 'Unknown Anthropic error',
      at,
    });
  }
});
