// AuditBinderPanel — per-record audit history strip.
//
// Plain English: drop this component on any detail page (an estimate,
// an AP invoice, a job, a CO, a CPR) and it renders the timeline of
// audit events for THAT record. Same data + filtering as the global
// /audit screen, just narrowed to one entity. The panel collapses to
// the most-recent N events with a 'view all' link to the global
// screen pre-filtered to the same entity.
//
// Server component — fetches at request time, no client JS needed.
// The events are read-only; recordAudit writes happen elsewhere.

import Link from 'next/link';
import {
  changedFields,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
} from '@yge/shared';
import { StatusPill } from './status-pill';

interface Props {
  entityType: AuditEntityType;
  entityId: string;
  /** Max events to render in the strip. Default 8. */
  limit?: number;
  /** Override className on the wrapper. */
  className?: string;
}

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse {
  events: AuditEvent[];
  total: number;
}

async function fetchEvents(entityType: string, entityId: string, limit: number): Promise<ListResponse> {
  try {
    const url =
      `${apiBaseUrl()}/api/audit-events?` +
      new URLSearchParams({ entityType, entityId, limit: String(limit) }).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { events: [], total: 0 };
    return (await res.json()) as ListResponse;
  } catch {
    return { events: [], total: 0 };
  }
}

const ACTION_TONE: Partial<Record<AuditAction, 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted'>> = {
  create: 'success',
  approve: 'success',
  pay: 'success',
  sign: 'success',
  post: 'success',
  reject: 'danger',
  void: 'danger',
  delete: 'danger',
  archive: 'muted',
  submit: 'info',
  answer: 'info',
  reopen: 'warn',
};

function actionTone(a: AuditAction): 'success' | 'warn' | 'danger' | 'info' | 'neutral' | 'muted' {
  return ACTION_TONE[a] ?? 'neutral';
}

export async function AuditBinderPanel({
  entityType,
  entityId,
  limit = 8,
  className,
}: Props) {
  const data = await fetchEvents(entityType, entityId, limit);
  const events = data.events;

  return (
    <section className={`mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm ${className ?? ''}`}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Audit history
        </h3>
        <Link
          href={`/audit?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`}
          className="text-xs text-yge-blue-500 hover:underline"
        >
          {data.total > limit ? `View all ${data.total} →` : 'Open in audit log →'}
        </Link>
      </header>

      {events.length === 0 ? (
        <p className="text-xs text-gray-500">
          No audit events recorded for this {entityType}. Either it's brand new
          or the audit log was rotated below this record's first mutation.
        </p>
      ) : (
        <ol className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-gray-100 pb-2 last:border-0">
              <time className="mt-0.5 shrink-0 font-mono text-[11px] text-gray-500">
                {e.createdAt.replace('T', ' ').slice(0, 16)}
              </time>
              <div className="shrink-0">
                <StatusPill label={e.action} tone={actionTone(e.action)} size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-700">
                  <span className="font-medium text-gray-900">
                    {e.actorUserId ?? <em className="text-gray-500">system</em>}
                  </span>
                  {(() => {
                    const fields = changedFields(e.before, e.after);
                    if (fields.length === 0) return null;
                    const label =
                      fields.slice(0, 4).join(', ') +
                      (fields.length > 4 ? `, +${fields.length - 4}` : '');
                    return (
                      <span className="ml-2 font-mono text-[11px] text-gray-500">
                        changed: {label}
                      </span>
                    );
                  })()}
                </div>
                {e.reason && (
                  <p className="mt-0.5 text-xs italic text-gray-600">"{e.reason}"</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
