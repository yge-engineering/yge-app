// Admin: integration health summary.
//
// Reports whether each external integration is configured + a
// rough most-recent-success/failure indicator. Pings are cheap or
// skipped (env-only checks) so the page loads fast.

import { Router } from 'express';
import { prisma } from '@yge/db';
import { isMicrosoftConfigured } from '../lib/microsoft-graph';
import { isGustoConfigured } from '../lib/gusto';
import { isStorageConfigured } from '../lib/storage';

export const adminHealthRouter = Router();

adminHealthRouter.get('/health/integrations', async (_req, res, next) => {
  try {
    // Anthropic — we only check env var presence; an actual ping
    // costs tokens.
    const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

    // Postgres — try a trivial query. Errors here usually mean a
    // pooler issue or a stale DATABASE_URL.
    let postgresOk = false;
    let postgresError: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      postgresOk = true;
    } catch (err) {
      postgresError = (err as Error).message.slice(0, 300);
    }

    // Migrations applied (read from _prisma_migrations meta table).
    let migrationCount = 0;
    try {
      const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        'SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL',
      );
      migrationCount = Number(rows[0]?.count ?? 0);
    } catch {
      /* table might not exist on first deploy */
    }

    // Recent error count (last 24h).
    let errorsLast24h = 0;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      errorsLast24h = await prisma.apiError.count({
        where: { occurredAt: { gte: since } },
      });
    } catch {
      /* swallow */
    }

    res.json({
      anthropic: { configured: anthropicConfigured },
      storage: { configured: isStorageConfigured() },
      microsoft: { configured: isMicrosoftConfigured() },
      gusto: { configured: isGustoConfigured() },
      postgres: { ok: postgresOk, error: postgresError, migrationCount },
      observability: { errorsLast24h },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
