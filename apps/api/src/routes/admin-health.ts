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

// Per-entity record counts. Used by /admin/data-health to flag
// a wiped table (count=0) before the user notices.
adminHealthRouter.get('/health/data-counts', async (_req, res, next) => {
  try {
    const tables = [
      'job', 'customer', 'vendor', 'employee', 'user',
      'estimate', 'bidItem', 'costLine', 'bidTab', 'bidResult',
      'arInvoice', 'apInvoice', 'arPayment', 'apPayment',
      'bankRec', 'journalEntry', 'expense',
      'dailyReport', 'timeCard', 'dispatch',
      'lienWaiver', 'certifiedPayroll', 'submittal', 'rfi',
      'changeOrder', 'pco',
      'document',
    ] as const;

    const counts: Record<string, number> = {};
    const mostRecentCreatedAt: Record<string, string | null> = {};

    // We run count + findFirst (orderBy createdAt desc) per table in
    // parallel. Each table gives us {count, latestCreatedAt}.
    await Promise.all(
      tables.map(async (t) => {
        interface ModelLike {
          count(): Promise<number>;
          findFirst(args: {
            orderBy: { createdAt: 'desc' };
            select: { createdAt: true };
          }): Promise<{ createdAt: Date } | null>;
        }
        const model = (prisma as unknown as Record<string, ModelLike | undefined>)[t];
        if (!model) return;
        const [n, latest] = await Promise.all([
          model.count(),
          model.findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);
        // camelCase API field — convert table name's first char.
        const apiKey = t === 'user' ? 'users'
          : t === 'job' ? 'jobs'
          : t === 'customer' ? 'customers'
          : t === 'vendor' ? 'vendors'
          : t === 'employee' ? 'employees'
          : t === 'estimate' ? 'estimates'
          : t === 'bidItem' ? 'bidItems'
          : t === 'costLine' ? 'costLines'
          : t === 'bidTab' ? 'bidTabs'
          : t === 'bidResult' ? 'bidResults'
          : t === 'arInvoice' ? 'arInvoices'
          : t === 'apInvoice' ? 'apInvoices'
          : t === 'arPayment' ? 'arPayments'
          : t === 'apPayment' ? 'apPayments'
          : t === 'bankRec' ? 'bankRecs'
          : t === 'journalEntry' ? 'journalEntries'
          : t === 'expense' ? 'expenses'
          : t === 'dailyReport' ? 'dailyReports'
          : t === 'timeCard' ? 'timeCards'
          : t === 'dispatch' ? 'dispatches'
          : t === 'lienWaiver' ? 'lienWaivers'
          : t === 'certifiedPayroll' ? 'certifiedPayrolls'
          : t === 'submittal' ? 'submittals'
          : t === 'rfi' ? 'rfis'
          : t === 'changeOrder' ? 'changeOrders'
          : t === 'pco' ? 'pcos'
          : 'documents';
        counts[apiKey] = n;
        mostRecentCreatedAt[apiKey] = latest?.createdAt
          ? latest.createdAt.toISOString()
          : null;
      }),
    );

    res.json({
      counts,
      mostRecentCreatedAt,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/health/migrations-status — compare migrations on
// disk (in packages/db/prisma/migrations/) to rows in
// _prisma_migrations. Drift = silent prod bugs (see
// docs/MIGRATION_TROUBLESHOOTING.md for the 2026-05-13 incident).
adminHealthRouter.get('/health/migrations-status', async (_req, res, next) => {
  try {
    // List migration directories that ship with the deployed code.
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    // The API runs from apps/api; migrations live at
    // packages/db/prisma/migrations relative to repo root.
    // Try a few candidate paths so this works both in dev (tsx from src)
    // and prod (compiled dist).
    const candidates = [
      path.join(process.cwd(), 'packages/db/prisma/migrations'),
      path.join(process.cwd(), '..', '..', 'packages/db/prisma/migrations'),
      path.join(__dirname, '..', '..', '..', '..', 'packages/db/prisma/migrations'),
    ];
    let migrationsDir: string | null = null;
    for (const c of candidates) {
      try {
        const stat = await fs.stat(c);
        if (stat.isDirectory()) {
          migrationsDir = c;
          break;
        }
      } catch {
        /* try next */
      }
    }

    let onDisk: string[] = [];
    if (migrationsDir) {
      const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
      onDisk = entries
        .filter((e) => e.isDirectory() && /^\d{14}_/.test(e.name))
        .map((e) => e.name)
        .sort();
    }

    // Read _prisma_migrations.
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
      `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name ASC`,
    );
    const appliedOnDb = rows.map((r) => r.migration_name);

    const dbSet = new Set(appliedOnDb);
    const diskSet = new Set(onDisk);
    const missingFromDb = onDisk.filter((m) => !dbSet.has(m));
    const extraInDb = appliedOnDb.filter((m) => !diskSet.has(m));

    const inSync = missingFromDb.length === 0 && extraInDb.length === 0;

    res.json({
      inSync,
      migrationsDir: migrationsDir ?? '(not found at runtime)',
      onDiskCount: onDisk.length,
      appliedOnDbCount: appliedOnDb.length,
      missingFromDb,
      extraInDb,
      // Loud diagnostic so the answer is obvious from the response alone.
      verdict: inSync
        ? 'OK — all migrations on disk are applied in production.'
        : missingFromDb.length > 0
          ? `DRIFT — ${missingFromDb.length} migration(s) on disk are NOT applied. Run prisma migrate deploy or apply manually.`
          : `EXTRA — ${extraInDb.length} migration(s) in DB are not in the codebase. Investigate before assuming DB is canonical.`,
    });
  } catch (err) {
    next(err);
  }
});

