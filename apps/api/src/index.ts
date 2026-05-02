// YGE API entry point.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { dirRateSyncRouter } from './routes/dir-rate-sync';
import { signaturesRouter } from './routes/signatures';
import { masterProfileRouter } from './routes/master-profile';
import { pdfFormMappingsRouter } from './routes/pdf-form-mappings';
import { otpRouter } from './routes/otp';
import { legalHoldsRouter } from './routes/legal-holds';
import { recordsRetentionRouter } from './routes/records-retention';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));

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
app.use('/api/dir-rate-sync', dirRateSyncRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/master-profile', masterProfileRouter);
app.use('/api/pdf-form-mappings', pdfFormMappingsRouter);
app.use('/api/otp', otpRouter);
app.use('/api/legal-holds', legalHoldsRouter);
app.use('/api/records-retention', recordsRetentionRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler — last middleware
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Server Error' });
  },
);

const port = Number(process.env.API_PORT ?? 4000);
app.listen(port, () => {
  logger.info(`YGE API listening on http://localhost:${port}`);
});
