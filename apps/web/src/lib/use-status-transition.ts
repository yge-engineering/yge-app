'use client';

// Shared status-transition hook used by every *-status-bar component.
//
// Plain English: each entity (dispatch, RFI, JE, AP invoice, etc.) has its
// own status enum and lifecycle, but the actual PATCH-and-refresh logic is
// the same shape every time:
//
//   1. set busy=true, clear error
//   2. PATCH /api/<route>/<id> with { status: next, ...extras }
//   3. on success → update local state, router.refresh()
//   4. on failure → show server error, leave status unchanged
//   5. always clear busy
//
// Extracting the boilerplate to one place means new status bars only need
// to declare the route + the per-transition extras, and bugfixes (e.g. the
// next-server vs client error parsing) land in one place instead of N.

import { useRouter } from 'next/navigation';
import { useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface StatusTransitionOptions<TStatus extends string> {
  /** Route relative to /api — e.g. 'rfis', 'ap-invoices'. */
  route: string;
  /** Entity id. */
  id: string;
  /** Current status (held by the calling component). */
  initial: TStatus;
}

export interface StatusTransitionResult<TStatus extends string> {
  status: TStatus;
  busy: boolean;
  error: string | null;
  /** Trigger a status change, optionally with extra patch fields
   *  (e.g. timestamps the bar wants to stamp atomically). Returns
   *  true on success, false on any kind of failure. */
  transition: (next: TStatus, extras?: Record<string, unknown>) => Promise<boolean>;
}

export function useStatusTransition<TStatus extends string>({
  route,
  id,
  initial,
}: StatusTransitionOptions<TStatus>): StatusTransitionResult<TStatus> {
  const router = useRouter();
  const [status, setStatus] = useState<TStatus>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(
    next: TStatus,
    extras?: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/${route}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, ...(extras ?? {}) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Transition failed (${res.status}).`);
        return false;
      }
      setStatus(next);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { status, busy, error, transition };
}

/**
 * Convenience: return a fresh ISO timestamp (UTC) for stamping
 * server-side dates from a transition button.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Convenience: return today's yyyy-mm-dd string for entities that store
 * dates as date-only strings (regex /^\d{4}-\d{2}-\d{2}$/).
 */
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
