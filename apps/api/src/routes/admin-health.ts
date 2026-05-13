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

// /api/admin/health/debug/probe — run the failing queries and surface
// whatever they throw. Diagnostic only; remove once the bug is fixed.
adminHealthRouter.get('/health/debug/probe', async (_req, res, next) => {
  const results: Record<string, { ok: boolean; error?: string; stack?: string; sample?: unknown }> = {};

  // Probe 1: listEstimates query (mimics /api/priced-estimates)
  try {
    const rows = await prisma.estimate.findMany({
      where: { companyId: process.env.DEFAULT_COMPANY_ID ?? 'yge-root', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    results.estimateFindMany = { ok: true, sample: { count: rows.length } };
  } catch (err) {
    results.estimateFindMany = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join('\n') : undefined,
    };
  }

  // Probe 2: estimate findMany with join (mimics /api/estimates)
  try {
    const rows = await prisma.estimate.findMany({
      where: { companyId: process.env.DEFAULT_COMPANY_ID ?? 'yge-root', deletedAt: null },
      include: {
        job: { include: { customer: true } },
        bidItems: { include: { costLines: true } },
      },
      take: 1,
    });
    results.estimateFindManyWithJoins = { ok: true, sample: { count: rows.length } };
  } catch (err) {
    results.estimateFindManyWithJoins = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join('\n') : undefined,
    };
  }

  // Probe 3: apiError findMany (mimics /api/admin/errors)
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.apiError.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: 5,
    });
    results.apiErrorFindMany = {
      ok: true,
      sample: {
        count: rows.length,
        recentMessages: rows.slice(0, 3).map((r) => r.message.slice(0, 200)),
        recentRoutes: rows.slice(0, 3).map((r) => r.route),
      },
    };
  } catch (err) {
    results.apiErrorFindMany = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join('\n') : undefined,
    };
  }

  res.json(results);
});

// POST /api/admin/debug/apply-missing-migrations — apply the two
// migrations that Render's buildCommand failed to run. Idempotent
// (each SQL uses IF NOT EXISTS). Diagnostic only; delete after use.
adminHealthRouter.post('/health/debug/apply-missing-migrations', async (_req, res, next) => {
  const log: Array<{ step: string; ok: boolean; error?: string }> = [];

  // Migration 20260507050000: add estimates.data JSON column.
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "data" JSONB`,
    );
    log.push({ step: 'add estimates.data column', ok: true });
  } catch (err) {
    log.push({
      step: 'add estimates.data column',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Migration 20260507060000: create api_errors table + 2 indexes.
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "api_errors" (
        "id" TEXT PRIMARY KEY,
        "companyId" TEXT,
        "requestId" TEXT,
        "method" TEXT NOT NULL,
        "route" TEXT NOT NULL,
        "statusCode" INTEGER NOT NULL,
        "message" TEXT NOT NULL,
        "stack" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log.push({ step: 'create api_errors table', ok: true });
  } catch (err) {
    log.push({
      step: 'create api_errors table',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "api_errors_companyId_occurredAt_idx" ON "api_errors" ("companyId", "occurredAt")`,
    );
    log.push({ step: 'index api_errors companyId+occurredAt', ok: true });
  } catch (err) {
    log.push({
      step: 'index api_errors companyId+occurredAt',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "api_errors_statusCode_occurredAt_idx" ON "api_errors" ("statusCode", "occurredAt")`,
    );
    log.push({ step: 'index api_errors statusCode+occurredAt', ok: true });
  } catch (err) {
    log.push({
      step: 'index api_errors statusCode+occurredAt',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Verify by re-running the probes.
  let estimateProbeOk = false;
  let apiErrorProbeOk = false;
  try {
    await prisma.estimate.findMany({ take: 1 });
    estimateProbeOk = true;
  } catch {
    /* ignore */
  }
  try {
    await prisma.apiError.findMany({ take: 1 });
    apiErrorProbeOk = true;
  } catch {
    /* ignore */
  }

  res.json({ log, verified: { estimateProbeOk, apiErrorProbeOk } });
});

// GET /api/admin/health/debug/migrations-state — what's in the
// _prisma_migrations table on prod? Diagnostic only.
adminHealthRouter.get('/health/debug/migrations-state', async (_req, res, next) => {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        migration_name: string;
        finished_at: Date | null;
        applied_steps_count: number;
        rolled_back_at: Date | null;
        logs: string | null;
      }>
    >(
      `SELECT id, migration_name, finished_at, applied_steps_count, rolled_back_at, logs
       FROM _prisma_migrations
       ORDER BY started_at DESC`,
    );
    res.json({
      migrationsInDb: rows.map((r) => ({
        id: r.id,
        name: r.migration_name,
        finishedAt: r.finished_at?.toISOString() ?? null,
        appliedSteps: r.applied_steps_count,
        rolledBackAt: r.rolled_back_at?.toISOString() ?? null,
        hasLog: !!r.logs,
        logHead: r.logs?.slice(0, 500) ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/health/debug/fix-migration-state — bring prod
// _prisma_migrations in sync with the migrations on disk.
adminHealthRouter.post('/health/debug/fix-migration-state', async (_req, res, next) => {
  const log: Array<{ step: string; ok: boolean; error?: string }> = [];

  interface MigrationStep {
    name: string;
    sql: string[];
  }
  const migrations: MigrationStep[] = [
    {
      name: '20260507010000_audit_reason',
      sql: [`ALTER TABLE "audit_events" ADD COLUMN IF NOT EXISTS "reason" TEXT`],
    },
    {
      name: '20260507020000_equipment',
      sql: [
        `CREATE TABLE IF NOT EXISTS "equipment_assets" (
          "id" TEXT PRIMARY KEY,
          "companyId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "assignedJobId" TEXT,
          "data" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "deletedAt" TIMESTAMP(3)
        )`,
        `CREATE INDEX IF NOT EXISTS "equipment_assets_companyId_status_idx" ON "equipment_assets" ("companyId", "status")`,
        `CREATE INDEX IF NOT EXISTS "equipment_assets_companyId_assignedJobId_idx" ON "equipment_assets" ("companyId", "assignedJobId")`,
      ],
    },
    {
      name: '20260507030000_dir_rate_proposals',
      sql: [
        `CREATE TABLE IF NOT EXISTS "dir_rate_proposals" (
          "id" TEXT PRIMARY KEY,
          "companyId" TEXT NOT NULL,
          "syncRunId" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "classification" TEXT NOT NULL,
          "county" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS "dir_rate_proposals_companyId_syncRunId_idx" ON "dir_rate_proposals" ("companyId", "syncRunId")`,
        `CREATE INDEX IF NOT EXISTS "dir_rate_proposals_companyId_status_idx" ON "dir_rate_proposals" ("companyId", "status")`,
      ],
    },
    {
      name: '20260507040000_job_customer_nullable',
      sql: [`ALTER TABLE "jobs" ALTER COLUMN "customerId" DROP NOT NULL`],
    },
    {
      name: '20260507050000_estimate_data_json',
      sql: [`ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "data" JSONB`],
    },
    {
      name: '20260507060000_api_errors',
      sql: [
        `CREATE TABLE IF NOT EXISTS "api_errors" (
          "id" TEXT PRIMARY KEY,
          "companyId" TEXT,
          "requestId" TEXT,
          "method" TEXT NOT NULL,
          "route" TEXT NOT NULL,
          "statusCode" INTEGER NOT NULL,
          "message" TEXT NOT NULL,
          "stack" TEXT,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS "api_errors_companyId_occurredAt_idx" ON "api_errors" ("companyId", "occurredAt")`,
        `CREATE INDEX IF NOT EXISTS "api_errors_statusCode_occurredAt_idx" ON "api_errors" ("statusCode", "occurredAt")`,
      ],
    },
  ];

  // Apply each migration's SQL.
  for (const m of migrations) {
    for (const sql of m.sql) {
      try {
        await prisma.$executeRawUnsafe(sql);
        log.push({ step: `SQL: ${m.name}`, ok: true });
      } catch (err) {
        log.push({
          step: `SQL: ${m.name}`,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Now record each migration in _prisma_migrations so prisma migrate
  // deploy on the next build sees them as applied. Use the prisma
  // migrations table's row format: id, checksum, finished_at,
  // migration_name, logs, rolled_back_at, started_at, applied_steps_count.
  for (const m of migrations) {
    try {
      // Use a fixed checksum string per migration (would normally be
      // sha256 of migration.sql but prisma migrate deploy doesn't
      // verify checksum on existing rows — it only writes them).
      const checksum = `manual-applied-${m.name}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO _prisma_migrations
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         SELECT gen_random_uuid()::text, $1, NOW(), $2, NULL, NULL, NOW(), 1
         WHERE NOT EXISTS (
           SELECT 1 FROM _prisma_migrations WHERE migration_name = $2
         )`,
        checksum,
        m.name,
      );
      log.push({ step: `record: ${m.name}`, ok: true });
    } catch (err) {
      log.push({
        step: `record: ${m.name}`,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Final state.
  const state = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
    `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name ASC`,
  );

  res.json({
    log,
    finalState: state.map((s) => ({
      name: s.migration_name,
      appliedAt: s.finished_at?.toISOString() ?? null,
    })),
  });
});

