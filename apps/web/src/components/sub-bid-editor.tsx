'use client';

// Subcontractor list editor — CA Public Contract Code §4104.
//
// Why this exists: California public works rules require the prime to list
// every sub doing more than a threshold dollar amount of work (0.5% of bid,
// or $10K floor on streets/highways/bridges). Forgetting a sub makes the bid
// non-responsive. This editor surfaces the threshold live and color-codes
// each row so the estimator can see at a glance which subs MUST appear on
// the bid form.
//
// Wire shape: we PUT the whole array to /sub-bids on every commit. Subs
// are usually 5-15 rows; sending the whole array on each save trades a few
// extra bytes for atomicity (no edit-in-the-middle race) and keeps the
// handler dead-simple on the server.

import { useEffect, useState } from 'react';
import { useTranslator, type Translator } from '../lib/use-translator';
import {
  classifySubBids,
  formatUSD,
  newSubBidId,
  type PricedEstimate,
  type SubBid,
  type SubBidClassification,
} from '@yge/shared';

interface Props {
  estimate: PricedEstimate;
  /** Current bid total in cents — used by the §4104 threshold math. Comes
   *  from the parent's totals state so the threshold updates live as unit
   *  prices change. */
  bidTotalCents: number;
  apiBaseUrl: string;
  /** Parent updates its own estimate state when subs change so the rest
   *  of the page (e.g. print link) stays in sync. */
  onSubsUpdated: (subs: SubBid[]) => void;
}

interface DraftRow extends SubBid {
  /** True if this row was added in this session and hasn't been saved yet
   *  — UI shows a subtle "new" hint and treats Cancel as Remove. */
  isNew?: boolean;
}

export function SubBidEditor({
  estimate,
  bidTotalCents,
  apiBaseUrl,
  onSubsUpdated,
}: Props) {
  const t = useTranslator();
  const [rows, setRows] = useState<DraftRow[]>(estimate.subBids);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the parent reloads the estimate (e.g. after navigation), pull in
  // any sub list change. We don't blow away unsaved local edits for the
  // same id, just append/replace by id.
  useEffect(() => {
    setRows((prev) => {
      // Trust server values for any id present in both; keep purely-local
      // (isNew) rows alongside.
      const byId = new Map<string, DraftRow>();
      for (const r of estimate.subBids) byId.set(r.id, r);
      const localOnly = prev.filter((r) => r.isNew && !byId.has(r.id));
      return [...estimate.subBids, ...localOnly];
    });
  }, [estimate.subBids]);

  const classification = classifySubBids(
    rows.map(stripDraftFlags),
    bidTotalCents,
    estimate.projectType,
  );

  async function persist(next: DraftRow[]) {
    setSaving(true);
    setError(null);
    try {
      const cleaned = next.map(stripDraftFlags);
      const res = await fetch(
        `${apiBaseUrl}/api/priced-estimates/${estimate.id}/sub-bids`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subBids: cleaned }),
        },
      );
      if (!res.ok) {
        const body = await safeReadJson(res);
        throw new Error(body?.error || t('subBid.errStatus', { status: res.status }));
      }
      // Server is source of truth — drop the isNew flags now that they're saved.
      setRows(cleaned);
      onSubsUpdated(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('subBid.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function handleAddRow() {
    const fresh: DraftRow = {
      id: newSubBidId(),
      contractorName: '',
      portionOfWork: '',
      bidAmountCents: 0,
      isNew: true,
    };
    setRows((prev) => [...prev, fresh]);
  }

  function handleRowChange(id: string, patch: Partial<SubBid>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function handleRowRemove(id: string) {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    // If the removed row had been saved, persist the deletion. Purely-local
    // (never-saved) rows just disappear.
    const wasSaved = estimate.subBids.some((s) => s.id === id);
    if (wasSaved) void persist(next);
  }

  function handleRowCommit(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    // Don't save a row that's still missing required fields — let the
    // estimator fill it in. Empty rows can stay in local state without
    // hitting the server.
    if (!row.contractorName.trim() || !row.portionOfWork.trim()) return;
    const cleaned = rows
      .filter(
        (r) => r.contractorName.trim() && r.portionOfWork.trim(),
      )
      .map(stripDraftFlags);
    void persist(cleaned);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('subBid.title')}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {t('subBid.intro')}
          </p>
        </div>
        <button
          onClick={handleAddRow}
          className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
        >
          {t('subBid.add')}
        </button>
      </header>

      <ThresholdBanner classification={classification} t={t} />

      {error && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {t('subBid.errSave', { error })}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-xs italic text-gray-500">
          {t('subBid.empty')}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-2 py-1">{t('subBid.thStatus')}</th>
                <th className="px-2 py-1">{t('subBid.thContractor')}</th>
                <th className="px-2 py-1">{t('subBid.thCslb')}</th>
                <th className="px-2 py-1">{t('subBid.thDir')}</th>
                <th className="px-2 py-1">{t('subBid.thPortion')}</th>
                <th className="px-2 py-1 text-right">{t('subBid.thBidAmount')}</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <SubBidRow
                  key={row.id}
                  row={row}
                  bucket={bucketFor(row, classification)}
                  onChange={(patch) => handleRowChange(row.id, patch)}
                  onCommit={() => handleRowCommit(row.id)}
                  onRemove={() => handleRowRemove(row.id)}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div>
          {classification.totalSubCents > 0 && (
            <>{t('subBid.subTotal', { total: formatUSD(classification.totalSubCents) })}</>
          )}
        </div>
        {saving && <span className="text-gray-400">{t('subBid.saving')}</span>}
      </footer>
    </section>
  );
}

// ---- Subcomponents -------------------------------------------------------

type Bucket = 'mustList' | 'borderline' | 'optional' | 'incomplete';

function bucketFor(
  row: DraftRow,
  classification: SubBidClassification,
): Bucket {
  if (!row.contractorName.trim() || !row.portionOfWork.trim()) return 'incomplete';
  if (classification.mustList.some((s) => s.id === row.id)) return 'mustList';
  if (classification.borderline.some((s) => s.id === row.id)) return 'borderline';
  return 'optional';
}

function ThresholdBanner({
  classification,
  t,
}: {
  classification: SubBidClassification;
  t: Translator;
}) {
  const { thresholdCents, highwayFloor, mustList } = classification;
  return (
    <div className="rounded border border-yge-blue-200 bg-yge-blue-50 p-2 text-xs text-gray-800">
      <div>
        <strong>{t('subBid.thHeader')}</strong>{' '}
        <span className="font-mono">{formatUSD(thresholdCents)}</span>{' '}
        {highwayFloor ? (
          <span className="text-gray-600">{t('subBid.thHighway')}</span>
        ) : (
          <span className="text-gray-600">{t('subBid.thStandard')}</span>
        )}
      </div>
      <div className="mt-1">
        {mustList.length === 0 ? (
          <span className="text-gray-700">{t('subBid.noneAbove')}</span>
        ) : (
          <span className="font-semibold text-red-700">
            {mustList.length === 1
              ? t('subBid.mustListOne')
              : t('subBid.mustListMany', { count: mustList.length })}
          </span>
        )}
      </div>
    </div>
  );
}

function bucketChipClasses(b: Bucket): string {
  if (b === 'mustList') return 'bg-red-100 text-red-800';
  if (b === 'borderline') return 'bg-yellow-100 text-yellow-800';
  if (b === 'optional') return 'bg-gray-100 text-gray-700';
  return 'bg-gray-50 text-gray-400';
}

function bucketLabel(b: Bucket, t: Translator): string {
  if (b === 'mustList') return t('subBid.bucketMustList');
  if (b === 'borderline') return t('subBid.bucketBorderline');
  if (b === 'optional') return t('subBid.bucketOptional');
  return t('subBid.bucketIncomplete');
}

function SubBidRow({
  row,
  bucket,
  onChange,
  onCommit,
  onRemove,
  t,
}: {
  row: DraftRow;
  bucket: Bucket;
  onChange: (patch: Partial<SubBid>) => void;
  onCommit: () => void;
  onRemove: () => void;
  t: Translator;
}) {
  const [amountText, setAmountText] = useState<string>(
    row.bidAmountCents > 0 ? (row.bidAmountCents / 100).toFixed(2) : '',
  );

  useEffect(() => {
    setAmountText(
      row.bidAmountCents > 0 ? (row.bidAmountCents / 100).toFixed(2) : '',
    );
  }, [row.bidAmountCents]);

  function commitAmount() {
    const trimmed = amountText.trim();
    const n = trimmed === '' ? 0 : Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      setAmountText(
        row.bidAmountCents > 0 ? (row.bidAmountCents / 100).toFixed(2) : '',
      );
      return;
    }
    const cents = Math.round(n * 100);
    if (cents !== row.bidAmountCents) {
      onChange({ bidAmountCents: cents });
    }
    onCommit();
  }

  return (
    <tr className={bucket === 'mustList' ? 'bg-red-50/40' : ''}>
      <td className="px-2 py-2 align-top">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bucketChipClasses(bucket)}`}
        >
          {bucketLabel(bucket, t)}
        </span>
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          value={row.contractorName}
          onChange={(e) => onChange({ contractorName: e.target.value })}
          onBlur={onCommit}
          placeholder={t('subBid.phContractor')}
          className="w-44 rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
        />
        <input
          type="text"
          value={row.address ?? ''}
          onChange={(e) => onChange({ address: e.target.value || undefined })}
          onBlur={onCommit}
          placeholder={t('subBid.phAddress')}
          className="mt-1 w-44 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          value={row.cslbLicense ?? ''}
          onChange={(e) =>
            onChange({ cslbLicense: e.target.value || undefined })
          }
          onBlur={onCommit}
          placeholder={t('subBid.phLicense')}
          className="w-24 rounded border border-gray-300 px-2 py-1 font-mono text-xs focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          value={row.dirRegistration ?? ''}
          onChange={(e) =>
            onChange({ dirRegistration: e.target.value || undefined })
          }
          onBlur={onCommit}
          placeholder={t('subBid.phDir')}
          className="w-28 rounded border border-gray-300 px-2 py-1 font-mono text-xs focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <input
          type="text"
          value={row.portionOfWork}
          onChange={(e) => onChange({ portionOfWork: e.target.value })}
          onBlur={onCommit}
          placeholder={t('subBid.phPortion')}
          className="w-56 rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
        />
      </td>
      <td className="px-2 py-2 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs text-gray-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="0.00"
            className="w-28 rounded border border-gray-300 px-2 py-1 text-right font-mono text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
          />
        </div>
      </td>
      <td className="px-2 py-2 text-right align-top">
        <button
          onClick={onRemove}
          className="text-xs text-gray-500 hover:text-red-700"
          title={t('subBid.removeTitle')}
        >
          {t('subBid.remove')}
        </button>
      </td>
    </tr>
  );
}

// ---- Helpers -------------------------------------------------------------

function stripDraftFlags(r: DraftRow): SubBid {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isNew, ...rest } = r;
  return rest;
}

async function safeReadJson(res: Response): Promise<{ error?: string } | null> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return null;
  }
}
