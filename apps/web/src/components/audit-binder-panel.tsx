'use client';

// AuditBinderPanel — per-record audit history strip.
//
// Plain English: drop this component on any detail page (an estimate,
// an AP invoice, a job, a CO, a CPR) and it renders the timeline of
// audit events for THAT record. Same data + filtering as the global
// /audit screen, just narrowed to one entity. The panel collapses to
// the most-recent N events with a 'view all' link to the global
// screen pre-filtered to the same entity.
//
// Client component — fetches on mount via `/api/audit-events`. Used to
// be a server component, but converting to client lets it be
// re-exported through the components barrel without dragging
// `next/headers` into client bundles. The events are read-only;
// recordAudit writes happen elsewhere.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  changedFields,
  type AuditAction,
  type AuditEntityType,
  type AuditEvent,
} from '@yge/shared';
import { StatusPill } from './status-pill';
import { useTranslator } from '../lib/use-translator';

interface Props {
  entityType: AuditEntityType;
  entityId: string;
  /** Max events to render in the strip. Default 8. */
  limit?: number;
  /** Override className on the wrapper. */
  className?: string;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ListResponse {
  events: AuditEvent[];
  total: number;
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

export function AuditBinderPanel({
  entityType,
  entityId,
  limit = 8,
  className,
}: Props) {
  const t = useTranslator();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url =
          `${apiBaseUrl()}/api/audit-events?` +
          new URLSearchParams({
            entityType,
            entityId,
            limit: String(limit),
          }).toString();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as ListResponse;
        if (!cancelled) {
          setEvents(data.events);
          setTotal(data.total);
        }
      } catch {
        // network blip — panel just stays empty
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, limit]);

  return (
    <section className={`mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm ${className ?? ''}`}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('auditBinder.title')}
        </h3>
        <Link
          href={`/audit?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`}
          className="text-xs text-yge-blue-500 hover:underline"
        >
          {total > limit
            ? t('auditBinder.viewAll', { count: total })
            : t('auditBinder.openInLog')}
        </Link>
      </header>

      {events.length === 0 ? (
        <p className="text-xs text-gray-500">
          {t('auditBinder.empty', { entityType })}
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
                    {e.actorUserId ?? <em className="text-gray-500">{t('auditBinder.system')}</em>}
                  </span>
                  {(() => {
                    const fields = changedFields(e.before, e.after);
                    if (fields.length === 0) return null;
                    const label =
                      fields.slice(0, 4).join(', ') +
                      (fields.length > 4 ? `, +${fields.length - 4}` : '');
                    return (
                      <span className="ml-2 font-mono text-[11px] text-gray-500">
                        {t('auditBinder.changed', { fields: label })}
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
