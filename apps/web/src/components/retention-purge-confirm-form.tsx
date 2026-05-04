// Per-bucket retention-purge confirm form.
//
// Shown beneath each non-empty bucket in the dry-run report. The
// operator types a plain-English justification, ticks the rows
// they want to confirm (eligible-and-not-frozen only), and POSTs.
// The API re-checks at apply-time so a stale dry-run can't slip
// frozen records through.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface PurgeRow {
  entityId: string;
  label: string;
  purgeEligibleOn: string;
  frozen: boolean;
}

interface Props {
  apiBaseUrl: string;
  entityType: string;
  bucketLabel: string;
  ruleAuthority: string;
  retainYears: number;
  rows: PurgeRow[];
}

export function RetentionPurgeConfirmForm({
  apiBaseUrl,
  entityType,
  bucketLabel,
  ruleAuthority,
  retainYears,
  rows,
}: Props) {
  const router = useRouter();
  const t = useTranslator();
  const eligibleRows = rows.filter((r) => !r.frozen);
  const initial = Object.fromEntries(eligibleRows.map((r) => [r.entityId, true]));

  const [picks, setPicks] = useState<Record<string, boolean>>(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function submit() {
    if (busy) return;
    setError(null);
    setFeedback(null);

    const entityIds = Object.entries(picks)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (entityIds.length === 0) {
      setError(t('retentionPurge.errPick'));
      return;
    }
    if (reason.trim().length < 10) {
      setError(t('retentionPurge.errReason'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/records-retention/confirm-purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityIds,
          operatorReason: reason.trim(),
          ruleAuthority,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        batch?: { id: string };
        rejectedNotEligible?: string[];
        rejectedFrozen?: string[];
        rejectedUnknown?: string[];
      };
      if (!res.ok) {
        setError(body.error ?? t('retentionPurge.errConfirm', { status: res.status }));
        return;
      }
      const rej =
        (body.rejectedNotEligible?.length ?? 0) +
        (body.rejectedFrozen?.length ?? 0) +
        (body.rejectedUnknown?.length ?? 0);
      const acceptedCount = entityIds.length - rej;
      setFeedback(
        t('retentionPurge.feedback', {
          batchId: body.batch?.id ?? '',
          accepted: acceptedCount,
          rejection: rej > 0 ? t('retentionPurge.feedbackRejected', { rejected: rej }) : '',
        }),
      );
      setReason('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (eligibleRows.length === 0) {
    return (
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        {t('retentionPurge.allFrozen')}
      </div>
    );
  }

  const pickedCount = Object.values(picks).filter(Boolean).length;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
        {t('retentionPurge.confirmTitle', {
          selected: pickedCount,
          total: eligibleRows.length,
          bucket: bucketLabel,
          years: retainYears,
          authority: ruleAuthority,
        })}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPicks(initial)}
          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100"
        >
          {t('retentionPurge.selectAll')}
        </button>
        <button
          type="button"
          onClick={() => setPicks({})}
          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100"
        >
          {t('retentionPurge.clear')}
        </button>
      </div>

      <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-[11px]">
        {eligibleRows.map((r) => (
          <li key={r.entityId} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={!!picks[r.entityId]}
              onChange={() => toggle(r.entityId)}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-gray-900">{r.label}</span>
              <span className="ml-2 font-mono text-gray-500">{r.entityId}</span>
              <span className="ml-2 text-gray-500">{t('retentionPurge.eligibleHint', { date: r.purgeEligibleOn })}</span>
            </span>
          </li>
        ))}
      </ul>

      <label className="mb-2 block">
        <span className="text-[11px] uppercase tracking-wide text-gray-500">
          {t('retentionPurge.reasonLabel')}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-xs"
          placeholder={t('retentionPurge.reasonPh', { entityType, authority: ruleAuthority, years: retainYears })}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? t('retentionPurge.busy') : t('retentionPurge.action', { count: pickedCount })}
        </button>
        {error && <span className="text-xs text-red-700">⚠ {error}</span>}
        {feedback && <span className="text-xs text-emerald-700">{feedback}</span>}
      </div>

      <p className="mt-2 text-[10px] text-gray-500">
        {t('retentionPurge.help')}
      </p>
    </div>
  );
}
