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
    const [
      jobs, customers, vendors, employees, users,
      estimates, bidItems, costLines,
      arInvoices, apInvoices, arPayments, apPayments,
      bankRecs, journalEntries, expenses,
      dailyReports, timeCards, dispatches,
      lienWaivers, certifiedPayrolls, submittals, rfis,
      changeOrders, pcos, bidTabs, bidResults,
      documents,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.customer.count(),
      prisma.vendor.count(),
      prisma.employee.count(),
      prisma.user.count(),
      prisma.estimate.count(),
      prisma.bidItem.count(),
      prisma.costLine.count(),
      prisma.arInvoice.count(),
      prisma.apInvoice.count(),
      prisma.arPayment.count(),
      prisma.apPayment.count(),
      prisma.bankRec.count(),
      prisma.journalEntry.count(),
      prisma.expense.count(),
      prisma.dailyReport.count(),
      prisma.timeCard.count(),
      prisma.dispatch.count(),
      prisma.lienWaiver.count(),
      prisma.certifiedPayroll.count(),
      prisma.submittal.count(),
      prisma.rfi.count(),
      prisma.changeOrder.count(),
      prisma.pco.count(),
      prisma.bidTab.count(),
      prisma.bidResult.count(),
      prisma.document.count(),
    ]);

    res.json({
      counts: {
        // Master data — non-zero is required for the app to be useful.
        jobs, customers, vendors, employees, users,
        // Estimating module.
        estimates, bidItems, costLines, bidTabs, bidResults,
        // Money module.
        arInvoices, apInvoices, arPayments, apPayments,
        bankRecs, journalEntries, expenses,
        // Field-ops module.
        dailyReports, timeCards, dispatches,
        // Compliance module.
        lienWaivers, certifiedPayrolls, submittals, rfis,
        changeOrders, pcos,
        // Document store.
        documents,
      },
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

