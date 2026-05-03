// Bid-tab bidder-list edit form.
//
// Operators sometimes need to fix a typo in a bidder name, add a
// bidder the scraper missed, or strike a bidder the agency
// rejected. The whole bidder array is replaced atomically — the
// store auto-reranks by totalCents, recomputes nameNormalized,
// and re-applies the awardedToBidderName mirror.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface BidderRow {
  /** Stable react key */
  key: string;
  name: string;
  totalDollars: string;
  cslbLicense: string;
  dirRegistration: string;
  dbe: boolean;
  sbe: boolean;
  withdrawn: boolean;
  rejected: boolean;
  rejectionReason: string;
  notes: string;
}

interface InitialBidder {
  name: string;
  totalCents: number;
  cslbLicense?: string;
  dirRegistration?: string;
  dbe?: boolean;
  sbe?: boolean;
  withdrawn?: boolean;
  rejected?: boolean;
  rejectionReason?: string;
  notes?: string;
}

interface Props {
  apiBaseUrl: string;
  tabId: string;
  initial: InitialBidder[];
}

let nextKey = 1;
function newKey(): string { return `b-${nextKey++}`; }

function toRow(b: InitialBidder): BidderRow {
  return {
    key: newKey(),
    name: b.name,
    totalDollars: b.totalCents > 0 ? (b.totalCents / 100).toString() : '',
    cslbLicense: b.cslbLicense ?? '',
    dirRegistration: b.dirRegistration ?? '',
    dbe: !!b.dbe,
    sbe: !!b.sbe,
    withdrawn: !!b.withdrawn,
    rejected: !!b.rejected,
    rejectionReason: b.rejectionReason ?? '',
    notes: b.notes ?? '',
  };
}

function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

export function BidTabBiddersEdit({ apiBaseUrl, tabId, initial }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<BidderRow[]>(() => initial.map(toRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows(initial.map(toRow));
    setError(null);
  }

  function update(key: string, patch: Partial<BidderRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function remove(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function add() {
    setRows((prev) => [
      ...prev,
      {
        key: newKey(),
        name: '',
        totalDollars: '',
        cslbLicense: '',
        dirRegistration: '',
        dbe: false,
        sbe: false,
        withdrawn: false,
        rejected: false,
        rejectionReason: '',
        notes: '',
      },
    ]);
  }

  async function save() {
    if (busy) return;
    setError(null);

    if (rows.length === 0) {
      setError(t('bidTabBiddersEdit.errMin'));
      return;
    }

    const payload: Array<{ name: string; totalCents: number; cslbLicense?: string; dirRegistration?: string; dbe?: boolean; sbe?: boolean; withdrawn?: boolean; rejected?: boolean; rejectionReason?: string; notes?: string }> = [];
    for (const r of rows) {
      if (r.name.trim().length === 0) {
        setError(t('bidTabBiddersEdit.errName'));
        return;
      }
      const cents = parseDollars(r.totalDollars);
      if (cents === null) {
        setError(t('bidTabBiddersEdit.errDollars', { name: r.name || t('bidTabBiddersEdit.unnamed') }));
        return;
      }
      const item: typeof payload[number] = {
        name: r.name.trim(),
        totalCents: cents,
      };
      if (r.cslbLicense.trim()) item.cslbLicense = r.cslbLicense.trim();
      if (r.dirRegistration.trim()) item.dirRegistration = r.dirRegistration.trim();
      if (r.dbe) item.dbe = true;
      if (r.sbe) item.sbe = true;
      if (r.withdrawn) item.withdrawn = true;
      if (r.rejected) item.rejected = true;
      if (r.rejectionReason.trim()) item.rejectionReason = r.rejectionReason.trim();
      if (r.notes.trim()) item.notes = r.notes.trim();
      payload.push(item);
    }

    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/bidders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidders: payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('bidTabBiddersEdit.errSave', { status: res.status }));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-yge-blue-500 hover:underline"
      >
        {t('bidTabBiddersEdit.editAction')}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-yge-blue-500 bg-yge-blue-50 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-gray-600">
        {t('bidTabBiddersEdit.heading')}
      </div>

      <div className="space-y-2">
        {rows.map((r, idx) => (
          <div key={r.key} className="rounded border border-gray-200 bg-white p-2 text-xs">
            <div className="grid gap-2 sm:grid-cols-12">
              <div className="sm:col-span-1 self-center text-[10px] text-gray-500">
                #{idx + 1}
              </div>
              <input
                type="text"
                placeholder={t('bidTabBiddersEdit.namePh')}
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                className="sm:col-span-5 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <input
                type="text"
                placeholder={t('bidTabBiddersEdit.totalPh')}
                value={r.totalDollars}
                onChange={(e) => update(r.key, { totalDollars: e.target.value })}
                className="sm:col-span-2 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
              <input
                type="text"
                placeholder={t('bidTabBiddersEdit.cslbPh')}
                value={r.cslbLicense}
                onChange={(e) => update(r.key, { cslbLicense: e.target.value })}
                className="sm:col-span-2 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
              <input
                type="text"
                placeholder={t('bidTabBiddersEdit.dirPh')}
                value={r.dirRegistration}
                onChange={(e) => update(r.key, { dirRegistration: e.target.value })}
                className="sm:col-span-1 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => remove(r.key)}
                className="sm:col-span-1 rounded border border-amber-500 bg-white px-2 py-1 text-[10px] text-amber-700 hover:bg-amber-50"
              >
                {t('bidTabBiddersEdit.remove')}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-gray-700">
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={r.dbe} onChange={(e) => update(r.key, { dbe: e.target.checked })} />
                {t('bidTabBiddersEdit.dbe')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={r.sbe} onChange={(e) => update(r.key, { sbe: e.target.checked })} />
                {t('bidTabBiddersEdit.sbe')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={r.withdrawn} onChange={(e) => update(r.key, { withdrawn: e.target.checked })} />
                {t('bidTabBiddersEdit.withdrew')}
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={r.rejected} onChange={(e) => update(r.key, { rejected: e.target.checked })} />
                {t('bidTabBiddersEdit.rejected')}
              </label>
              {r.rejected && (
                <input
                  type="text"
                  placeholder={t('bidTabBiddersEdit.rejectReasonPh')}
                  value={r.rejectionReason}
                  onChange={(e) => update(r.key, { rejectionReason: e.target.value })}
                  className="flex-1 min-w-[160px] rounded border border-gray-300 px-2 py-0.5 text-[10px]"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {t('bidTabBiddersEdit.addBidder')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy
            ? t('bidTabBiddersEdit.busy')
            : rows.length === 1
              ? t('bidTabBiddersEdit.saveOne')
              : t('bidTabBiddersEdit.saveMany', { count: rows.length })}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setEditing(false);
          }}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {t('bidTabBiddersEdit.cancel')}
        </button>
        {error && <span className="text-[11px] text-red-700">⚠ {error}</span>}
      </div>
      <p className="mt-2 text-[10px] text-gray-600">
        {t('bidTabBiddersEdit.help')}
      </p>
    </div>
  );
}
