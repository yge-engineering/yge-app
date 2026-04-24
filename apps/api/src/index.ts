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

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));

app.use('/health', healthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/plans-to-estimate', plansToEstimateRouter);

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
