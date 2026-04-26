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
