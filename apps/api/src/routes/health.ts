import { Router } from 'express';
import { prisma } from '@yge/db';
import { anthropic, DEFAULT_MODEL } from '../lib/anthropic';
import { isMicrosoftConfigured } from '../lib/microsoft-graph';
import { listMicrosoftTokens } from '../lib/microsoft-tokens-store';
import { getApInboxLastRun } from '../lib/ap-inbox-scheduler';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok', at: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', at: new Date().toISOString() });
  }
});

// GET /health/integrations — single roll-up that external uptime
// monitors can hit. Reports DB, Anthropic key presence, Microsoft
// configured + connected user count, AP inbox auto-poll freshness.
// Returns 200 with `degraded` parts called out individually so the
// monitor can decide which subsystem to alert on.
healthRouter.get('/integrations', async (_req, res) => {
  const at = new Date().toISOString();
  const result: Record<string, unknown> = { at };

  // DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db = { status: 'ok' };
  } catch (err) {
    result.db = {
      status: 'degraded',
      reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    };
  }

  // Anthropic — just key presence, no token spend.
  result.anthropic = process.env.ANTHROPIC_API_KEY
    ? { status: 'ok', keySet: true }
    : { status: 'degraded', reason: 'ANTHROPIC_API_KEY not set' };

  // Microsoft Graph
  try {
    const configured = isMicrosoftConfigured();
    if (!configured) {
      result.microsoft = {
        status: 'degraded',
        reason: 'MICROSOFT_TENANT_ID/CLIENT_ID/CLIENT_SECRET not all set',
      };
    } else {
      const tokens = await listMicrosoftTokens();
      result.microsoft = {
        status: 'ok',
        configured: true,
        connectedUsers: tokens.length,
      };
    }
  } catch (err) {
    result.microsoft = {
      status: 'degraded',
      reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    };
  }

  // AP inbox auto-poll freshness — alert if no run in 90 minutes
  // (3x the default 30-min cadence, so transient failures don't
  // page).
  const last = getApInboxLastRun();
  if (!last) {
    result.apInbox = { status: 'degraded', reason: 'No auto-poll has run yet' };
  } else {
    const ageMs = Date.now() - new Date(last.finishedAt).getTime();
    const stale = ageMs > 90 * 60 * 1_000;
    result.apInbox = {
      status: stale ? 'degraded' : 'ok',
      lastFinishedAt: last.finishedAt,
      ageMs,
      ...(stale ? { reason: 'Auto-poll has not run in >90 min' } : {}),
    };
  }

  return res.json(result);
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

healthRouter.get('/version', (_req, res) => {
  res.json({
    sha: process.env.BUILD_SHA ?? 'dev',
    node: process.version,
    deployedAt: process.env.BUILD_TIMESTAMP ?? null,
    at: new Date().toISOString(),
  });
});
