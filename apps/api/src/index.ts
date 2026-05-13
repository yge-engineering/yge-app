// YGE API entry point.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { tenantMiddleware } from './middleware/tenant';
import { requestIdMiddleware } from './middleware/request-id';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';
import { healthRouter } from './routes/health';
import { jobsRouter } from './routes/jobs';
import { estimatesRouter } from './routes/estimates';
import { plansToEstimateRouter } from './routes/plans-to-estimate';
import { pricedEstimatesRouter } from './routes/priced-estimates';
import { employeesRouter } from './routes/employees';
import { toolsRouter } from './routes/tools';
import { dailyReportsRouter } from './routes/daily-reports';
import { equipmentRouter } from './routes/equipment';
import { bidResultsRouter } from './routes/bid-results';
import { certificatesRouter } from './routes/certificates';
import { documentsRouter } from './routes/documents';
import { apInvoicesRouter } from './routes/ap-invoices';
import { rfisRouter } from './routes/rfis';
import { materialsRouter } from './routes/materials';
import { arInvoicesRouter } from './routes/ar-invoices';
import { submittalsRouter } from './routes/submittals';
import { changeOrdersRouter } from './routes/change-orders';
import { timeCardsRouter } from './routes/time-cards';
import { certifiedPayrollsRouter } from './routes/certified-payrolls';
import { vendorsRouter } from './routes/vendors';
import { arPaymentsRouter } from './routes/ar-payments';
import { lienWaiversRouter } from './routes/lien-waivers';
import { punchItemsRouter } from './routes/punch-items';
import { toolboxTalksRouter } from './routes/toolbox-talks';
import { incidentsRouter } from './routes/incidents';
import { weatherLogsRouter } from './routes/weather-logs';
import { pcosRouter } from './routes/pcos';
import { swpppInspectionsRouter } from './routes/swppp-inspections';
import { dispatchesRouter } from './routes/dispatches';
import { dirRatesRouter } from './routes/dir-rates';
import { photosRouter } from './routes/photos';
import { coaRouter } from './routes/coa';
import { journalEntriesRouter } from './routes/journal-entries';
import { apPaymentsRouter } from './routes/ap-payments';
import { bankRecsRouter } from './routes/bank-recs';
import { customersRouter } from './routes/customers';
import { mileageRouter } from './routes/mileage';
import { expensesRouter } from './routes/expenses';
import { auditRouter } from './routes/audit';
import { loginRouter } from './routes/login';
import { dirRateSyncRouter } from './routes/dir-rate-sync';
import { signaturesRouter } from './routes/signatures';
import { masterProfileRouter } from './routes/master-profile';
import { pdfFormMappingsRouter } from './routes/pdf-form-mappings';
import { otpRouter } from './routes/otp';
import { legalHoldsRouter } from './routes/legal-holds';
import { recordsRetentionRouter } from './routes/records-retention';
import { bidTabsRouter } from './routes/bid-tabs';
import { competitorsRouter } from './routes/competitors';
import { credentialsRouter } from './routes/credentials';
import { calendarEventsRouter } from './routes/calendar-events';
import { calendarShareRouter } from './routes/calendar-share';
import { foldersRouter } from './routes/folders';
import { costCodesRouter } from './routes/cost-codes';
import { equipmentRatesRouter } from './routes/equipment-rates';
import { importedEstimatesRouter } from './routes/imported-estimates';
import { microsoftRouter } from './routes/microsoft';
import { portalUsersRouter } from './routes/portal-users';
import { p2eFeedbackRouter } from './routes/p2e-feedback';
import { webauthnRouter } from './routes/webauthn';
import { pdfExtractRouter } from './routes/pdf-extract';
import { explainLineRouter } from './routes/explain-line';
import { subBidExtractRouter } from './routes/sub-bid-extract';
import { takeoffExtractRouter } from './routes/takeoff-extract';
import { crossCheckAddendaRouter } from './routes/cross-check-addenda';
import { adminErrorsRouter } from './routes/admin-errors';
import { adminBackfillRouter } from './routes/admin-backfill';
import { adminHealthRouter } from './routes/admin-health';
import { gustoRouter } from './routes/gusto';
import { portalSubRouter } from './routes/portal-sub';
import { reportsXlsxRouter } from './routes/reports-xlsx';
import { excelImportRouter } from './routes/excel-import';
import { estimatesExcelRouter } from './routes/estimates-excel';

const app = express();

app.use(helmet());

// CORS — allow the production web origins (custom domain + Vercel
// default) plus dev. Vercel preview deploys all live under
// *.vercel.app so we accept that pattern too. Server-to-server
// requests (which don't send an Origin header) are always allowed.
const ALLOWED_ORIGINS = new Set<string>([
  'http://localhost:3000',
  'https://app.youngge.com',
  'https://yge-app-web.vercel.app',
]);
const EXTRA_ORIGIN = process.env.NEXT_PUBLIC_APP_URL;
if (EXTRA_ORIGIN) ALLOWED_ORIGINS.add(EXTRA_ORIGIN);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      // Vercel preview deploys (e.g. yge-app-web-git-fix-xxx.vercel.app).
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(requestIdMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));

// Tenant resolution — every downstream handler reads its companyId
// from the per-request AsyncLocalStorage seeded here.
app.use(tenantMiddleware);

app.use('/health', healthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/plans-to-estimate', plansToEstimateRouter);
app.use('/api/priced-estimates', pricedEstimatesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/daily-reports', dailyReportsRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/bid-results', bidResultsRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/ap-invoices', apInvoicesRouter);
app.use('/api/rfis', rfisRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/ar-invoices', arInvoicesRouter);
app.use('/api/submittals', submittalsRouter);
app.use('/api/change-orders', changeOrdersRouter);
app.use('/api/time-cards', timeCardsRouter);
app.use('/api/certified-payrolls', certifiedPayrollsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/ar-payments', arPaymentsRouter);
app.use('/api/lien-waivers', lienWaiversRouter);
app.use('/api/punch-items', punchItemsRouter);
app.use('/api/toolbox-talks', toolboxTalksRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/weather-logs', weatherLogsRouter);
app.use('/api/pcos', pcosRouter);
app.use('/api/swppp-inspections', swpppInspectionsRouter);
app.use('/api/dispatches', dispatchesRouter);
app.use('/api/dir-rates', dirRatesRouter);
app.use('/api/photos', photosRouter);
app.use('/api/coa', coaRouter);
app.use('/api/journal-entries', journalEntriesRouter);
app.use('/api/ap-payments', apPaymentsRouter);
app.use('/api/bank-recs', bankRecsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/mileage', mileageRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/audit-events', auditRouter);
app.use('/api/login', loginRouter);
app.use('/api/dir-rate-sync', dirRateSyncRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/master-profile', masterProfileRouter);
app.use('/api/pdf-form-mappings', pdfFormMappingsRouter);
app.use('/api/otp', otpRouter);
app.use('/api/legal-holds', legalHoldsRouter);
app.use('/api/records-retention', recordsRetentionRouter);
app.use('/api/bid-tabs', bidTabsRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/calendar-events', calendarEventsRouter);
app.use('/api/calendar-share', calendarShareRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/cost-codes', costCodesRouter);
app.use('/api/equipment-rates', equipmentRatesRouter);
app.use('/api/imported-estimates', importedEstimatesRouter);
app.use('/api/microsoft', microsoftRouter);
app.use('/api/portal-users', portalUsersRouter);
app.use('/api/p2e-feedback', p2eFeedbackRouter);
app.use('/api/webauthn', webauthnRouter);
app.use('/api/pdf', pdfExtractRouter);
app.use('/api/priced-estimates', explainLineRouter);
app.use('/api/sub-bids', subBidExtractRouter);
app.use('/api/takeoff', takeoffExtractRouter);
app.use('/api/priced-estimates', crossCheckAddendaRouter);
app.use('/api/admin', adminErrorsRouter);
app.use('/api/admin', adminBackfillRouter);
app.use('/api/admin', adminHealthRouter);
app.use('/api/reports', reportsXlsxRouter);
app.use('/api/admin/excel-import', excelImportRouter);
app.use('/api/estimates', estimatesExcelRouter);
app.use('/api/gusto', gustoRouter);
app.use('/api/portal-sub', portalSubRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler — last middleware. Captures into api_errors
// table for observability + still logs to pino.
import { captureApiError } from './lib/api-error-capture';

app.use(
  (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(
      { err, requestId: req.requestId, method: req.method, url: req.originalUrl },
      'Unhandled error',
    );
    res.status(500).json({
      error: 'Internal Server Error',
      requestId: req.requestId,
    });
    // Fire-and-forget — don't await; if Postgres is down the
    // response should still go out.
    void captureApiError({
      err,
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: 500,
      ipAddress:
        (req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
          req.ip) ||
        null,
      userAgent: req.header('User-Agent') ?? null,
    });
  },
);

const port = Number(process.env.API_PORT ?? 4000);
app.listen(port, () => {
  logger.info(`YGE API listening on http://localhost:${port}`);
  // Kick off background pollers after the HTTP server is ready.
  // Disabled in test envs (vitest sets NODE_ENV=test).
  if (process.env.NODE_ENV !== 'test') {
    void import('./lib/ap-inbox-scheduler').then((m) =>
      m.startApInboxScheduler(),
    );
    void import('./lib/backup').then((m) => m.startBackupScheduler());
  }
});
