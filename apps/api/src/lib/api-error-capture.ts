// Capture unhandled errors into the api_errors table.
//
// Fail-soft: if the Postgres write itself fails, we log + return.
// Never let observability bugs break the user's request.

import { prisma } from '@yge/db';
import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { getRequestCompanyId } from './request-context';

export interface CaptureApiErrorInput {
  err: Error;
  requestId?: string;
  method: string;
  route: string;
  statusCode: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function captureApiError(input: CaptureApiErrorInput): Promise<void> {
  try {
    await prisma.apiError.create({
      data: {
        id: randomUUID(),
        companyId: getRequestCompanyId() ?? null,
        requestId: input.requestId ?? null,
        method: input.method,
        route: input.route.slice(0, 500),
        statusCode: input.statusCode,
        message: (input.err.message ?? 'Unknown error').slice(0, 4_000),
        stack: input.err.stack?.slice(0, 16_000) ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (writeErr) {
    // eslint-disable-next-line no-console
    logger.error(
      { writeErr, originalErr: input.err.message },
      'api_errors write failed (observability path)',
    );
  }
}
