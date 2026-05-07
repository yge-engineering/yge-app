// Stamp each request with a stable id for correlation.
//
// Plain English: when the office reports "I clicked Save and got an
// error at 11:42am," they can include the X-Request-Id from the
// response and we can pull the exact api_errors row + the matching
// pino log line.

import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Per-request correlation id, injected by requestIdMiddleware. */
      requestId?: string;
    }
  }
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  // Honor an inbound X-Request-Id (from a load balancer or test
  // harness) when it looks plausible, otherwise mint a fresh UUID.
  const inbound = req.header('X-Request-Id');
  const id =
    inbound && /^[a-zA-Z0-9-]{8,80}$/.test(inbound) ? inbound : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
