// Per-request context carried via Node's AsyncLocalStorage.
//
// Plain English: in Express, the same request handler is called
// across `await` boundaries that hop in and out of stores. We need
// a way to say "for THIS request, the companyId is X" without
// threading a parameter through every function call. AsyncLocalStorage
// is exactly that — set it once at the request edge, read it from
// any deeply-nested store function.

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  companyId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return storage.run(ctx, fn);
}

/** Returns the companyId for the current request, or undefined when
 *  there's no request context (background jobs, scripts, tests). */
export function getRequestCompanyId(): string | undefined {
  return storage.getStore()?.companyId;
}

/** Returns the actor user id for the current request, or null. */
export function getRequestActorUserId(): string | null {
  return storage.getStore()?.actorUserId ?? null;
}

/** Returns the full request context, or undefined. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
