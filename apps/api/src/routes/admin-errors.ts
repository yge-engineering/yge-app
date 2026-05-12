import { randomUUID } from 'node:crypto';
// Admin: list captured api_errors.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@yge/db';

export const adminErrorsRouter = Router();

const ListQuerySchema = z.object({
  since: z.string().optional(),
  statusCode: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
});

adminErrorsRouter.get('/errors', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const limit = Math.min(
      Math.max(Number(parsed.data.limit ?? 100) || 100, 1),
      500,
    );
    const sinceMs = parsed.data.since
      ? Date.parse(parsed.data.since)
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const since = Number.isFinite(sinceMs)
      ? new Date(sinceMs)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const statusCode = parsed.data.statusCode
      ? Number(parsed.data.statusCode)
      : undefined;
    const search = parsed.data.search?.trim() ?? '';

    const rows = await prisma.apiError.findMany({
      where: {
        occurredAt: { gte: since },
        ...(statusCode ? { statusCode } : {}),
        ...(search
          ? {
              OR: [
                { message: { contains: search, mode: 'insensitive' } },
                { route: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return res.json({
      errors: rows.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        requestId: r.requestId,
        method: r.method,
        route: r.route,
        statusCode: r.statusCode,
        message: r.message,
        stack: r.stack,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        occurredAt: r.occurredAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});
adminErrorsRouter.get('/errors/by-message', async (req, res, next) => {
  try {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    const sinceMs = parsed.data.since
      ? Date.parse(parsed.data.since)
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const since = Number.isFinite(sinceMs)
      ? new Date(sinceMs)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.apiError.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    });
    interface Bucket {
      message: string;
      count: number;
      latestAt: string;
      sampleStatusCode: number;
      sampleRoute: string;
      sampleRequestId: string | null;
    }
    const buckets = new Map<string, Bucket>();
    for (const r of rows) {
      const key = r.message.slice(0, 200);
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        if (r.occurredAt.toISOString() > existing.latestAt) {
          existing.latestAt = r.occurredAt.toISOString();
          existing.sampleStatusCode = r.statusCode;
          existing.sampleRoute = r.route;
          existing.sampleRequestId = r.requestId;
        }
      } else {
        buckets.set(key, {
          message: key,
          count: 1,
          latestAt: r.occurredAt.toISOString(),
          sampleStatusCode: r.statusCode,
          sampleRoute: r.route,
          sampleRequestId: r.requestId,
        });
      }
    }
    const top = [...buckets.values()]
      .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt))
      .slice(0, 20);
    return res.json({ groups: top, totalRowsScanned: rows.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/errors/log-client — capture an SSR/client error
// reported by the web's error.tsx. Production Next.js strips the
// real error message, so we capture digest + URL + UA at minimum.
adminErrorsRouter.post('/errors/log-client', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const digest = typeof body.digest === 'string' ? body.digest.slice(0, 200) : null;
    const url = typeof body.url === 'string' ? body.url.slice(0, 500) : 'unknown';
    const message =
      typeof body.message === 'string' ? body.message.slice(0, 4000) : '(client error)';
    const stack = typeof body.stack === 'string' ? body.stack.slice(0, 16000) : null;
    const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null;

    await prisma.apiError.create({
      data: {
        id: randomUUID(),
        companyId: null,
        requestId: null,
        method: 'GET',
        route: url,
        statusCode: 500,
        message: digest ? `[digest:${digest}] ${message}` : message,
        stack,
        ipAddress: null,
        userAgent,
      },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

