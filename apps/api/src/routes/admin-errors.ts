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
