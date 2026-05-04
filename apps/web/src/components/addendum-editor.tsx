'use client';

// Addendum acknowledgment editor.
//
// What the user sees: a small section under the bid security card. Each
// row is one addendum issued by the agency before bid open. The
// estimator types the agency's number, an optional date + one-line
// subject, and ticks the "I read and incorporated this" box. A red
// banner at the top counts how many are still un-acked — that's the
// number that gets the bid tossed at bid open if it's still > 0 when
// the envelope goes in.
//
// What it persists: the full `addenda` array on the estimate. We PATCH
// the estimate-level endpoint with `{ addenda }` on every commit. Like
// subBids, the array is small enough that wholesale-replace is cheaper
// than per-row endpoints.

import { useEffect, useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  sortedAddenda,
  unacknowledgedAddenda,
  type Addendum,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  apiBaseUrl: string;
  onUpdated: (estimate: PricedEstimate, totals: PricedEstimateTotals) => void;
}

interface DraftRow extends Addendum {
  isNew?: boolean;
}

function freshRow(): DraftRow {
  return {
    id: `add-${Math.random().toString(36).slice(2, 10)}`,
    number: '',
    acknowledged: false,
    isNew: true,
  };
}

export function AddendumEditor({ estimate, apiBaseUrl, onUpdated }: Props) {
  const t = useTranslator();
  const [rows, setRows] = useState<DraftRow[]>(estimate.addenda ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync if the parent estimate changes (e.g. after navigation back).
  useEffect(() => {
    setRows(estimate.addenda ?? []);
  }, [estimate.addenda]);

  const persisted = rows.filter((r) => !r.isNew && r.number.trim().length > 0);
  const unacked = unacknowledgedAddenda(persisted);
  const sortedForDisplay = sortedAddenda(persisted);

  async function persist(next: DraftRow[]) {
    setSaving(true);
    setError(null);
    try {
      // Strip the local-only flag before sending to the server.
      const cleaned: Addendum[] = next
        .filter((r) => r.number.trim().length > 0)
        .map(({ isNew: _isNew, ...rest }) => rest);
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addenda: cleaned }),
        },
      );
      if (!res.ok) throw new Error(t('addendumEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as {
        estimate: PricedEstimate;
        totals: PricedEstimateTotals;
      };
      onUpdated(json.estimate, json.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addendumEditor.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function commitRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row || row.number.trim().length === 0) return;
    const next = rows.map((r) =>
      r.id === id ? { ...r, isNew: false } : r,
    );
    setRows(next);
    void persist(next);
  }

  function toggleAcknowledged(id: string) {
    const next = rows.map((r) =>
      r.id === id ? { ...r, acknowledged: !r.acknowledged } : r,
    );
    setRows(next);
    if (next.find((r) => r.id === id)?.number.trim().length) {
      void persist(next);
    }
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    void persist(next);
  }

  function addRow() {
    setRows((cur) => [...cur, freshRow()]);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('addendumEditor.title')}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {t('addendumEditor.intro')}
          </p>
        </div>
        <button
          onClick={addRow}
          className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
        >
          {t('addendumEditor.add')}
        </button>
      </header>

      {unacked.length > 0 && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <strong className="font-semibold">
            {unacked.length === 1
              ? t('addendumEditor.unackedOne')
              : t('addendumEditor.unackedMany', { count: unacked.length })}
          </strong>{' '}
          {t('addendumEditor.unackedHint')}
        </div>
      )}

      {error && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {t('addendumEditor.errSave', { error })}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs italic text-gray-500">
          {t('addendumEditor.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {/* Display order: persisted rows sorted, then unsaved drafts at the end. */}
          {[
            ...sortedForDisplay,
            ...rows.filter((r) => r.isNew),
          ].map((row) => {
            const r = rows.find((x) => x.id === row.id) ?? row;
            const draftRow = r as DraftRow;
            return (
              <div
                key={r.id}
                className={`grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-[1fr_1fr_2fr_auto_auto] ${
                  r.acknowledged
                    ? 'border-green-200 bg-green-50/30'
                    : 'border-yellow-200 bg-yellow-50/30'
                }`}
              >
                <label className="text-xs text-gray-700">
                  <span className="mb-0.5 block font-medium">{t('addendumEditor.lblNumber')}</span>
                  <input
                    type="text"
                    value={r.number}
                    onChange={(e) =>
                      patchRow(r.id, { number: e.target.value })
                    }
                    onBlur={() => commitRow(r.id)}
                    placeholder={t('addendumEditor.phNumber')}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                  />
                </label>

                <label className="text-xs text-gray-700">
                  <span className="mb-0.5 block font-medium">{t('addendumEditor.lblDate')}</span>
                  <input
                    type="date"
                    value={r.dateIssued ?? ''}
                    onChange={(e) =>
                      patchRow(r.id, {
                        dateIssued: e.target.value || undefined,
                      })
                    }
                    onBlur={() => commitRow(r.id)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                  />
                </label>

                <label className="text-xs text-gray-700">
                  <span className="mb-0.5 block font-medium">
                    {t('addendumEditor.lblSubject')}{' '}
                    <span className="text-gray-400">{t('addendumEditor.subjectHint')}</span>
                  </span>
                  <input
                    type="text"
                    value={r.subject ?? ''}
                    onChange={(e) =>
                      patchRow(r.id, { subject: e.target.value || undefined })
                    }
                    onBlur={() => commitRow(r.id)}
                    placeholder={t('addendumEditor.phSubject')}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-700 md:self-end md:pb-1">
                  <input
                    type="checkbox"
                    checked={r.acknowledged}
                    onChange={() => toggleAcknowledged(r.id)}
                    disabled={
                      draftRow.isNew && r.number.trim().length === 0
                    }
                    className="h-4 w-4 rounded border-gray-300 text-yge-blue-600 focus:ring-yge-blue-500"
                  />
                  <span className="font-medium">{t('addendumEditor.acked')}</span>
                </label>

                <button
                  onClick={() => removeRow(r.id)}
                  className="text-xs text-gray-400 hover:text-red-700 md:self-end md:pb-1"
                  aria-label={t('addendumEditor.removeAria')}
                >
                  {t('addendumEditor.remove')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {saving && (
        <div className="mt-2 text-right text-xs text-gray-400">{t('addendumEditor.saving')}</div>
      )}
    </section>
  );
}
