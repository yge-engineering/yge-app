// Bid-tab 'mark awarded' shortcut.
//
// Operators read the agency's award memo / minutes a few weeks
// after open ('Caltrans D2 awarded 02-1H4404 to Knife River on
// 2026-05-15'). Instead of opening the core-fields edit form and
// hunting through 9 fields, this is a one-shot picker: bidder
// dropdown + award date + Confirm. The store-side mirror in
// patchBidTabCore syncs the bidder.awardedTo flag automatically.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface BidderOption {
  name: string;
  rank: number;
}

interface Props {
  apiBaseUrl: string;
  tabId: string;
  bidders: BidderOption[];
  currentAwardedToBidderName?: string;
  currentAwardedAt?: string;
}

export function BidTabMarkAwarded({
  apiBaseUrl,
  tabId,
  bidders,
  currentAwardedToBidderName,
  currentAwardedAt,
}: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState(currentAwardedToBidderName ?? '');
  const [awardedAt, setAwardedAt] = useState(currentAwardedAt ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setError(null);
    if (!picked) {
      setError(t('bidTabMarkAwarded.errPick'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/core`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awardedToBidderName: picked,
          awardedAt: awardedAt.trim().length === 0 ? null : awardedAt,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('bidTabMarkAwarded.errMark', { status: res.status }));
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

  async function clearAward() {
    if (busy) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(t('bidTabMarkAwarded.confirmClear'));
      if (!ok) return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs/${tabId}/core`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awardedToBidderName: null, awardedAt: null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('bidTabMarkAwarded.errClear', { status: res.status }));
        return;
      }
      setPicked('');
      setAwardedAt('');
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
        {currentAwardedToBidderName
          ? t('bidTabMarkAwarded.editAward')
          : t('bidTabMarkAwarded.markAwarded')}
      </button>
    );
  }

  // Help blurb has an inline <em> word — split-and-fill via sentinel.
  const helpTpl = t('bidTabMarkAwarded.help', { awardedItalic: '__AWARDED__' });
  const [helpPre, helpPost] = helpTpl.split('__AWARDED__');

  return (
    <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-gray-600">
            {t('bidTabMarkAwarded.awardedTo')}
          </span>
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">{t('bidTabMarkAwarded.pickBidder')}</option>
            {bidders.map((b) => (
              <option key={`${b.rank}-${b.name}`} value={b.name}>
                {b.rank}. {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-gray-600">
            {t('bidTabMarkAwarded.awardedDate')}
          </span>
          <input
            type="date"
            value={awardedAt}
            onChange={(e) => setAwardedAt(e.target.value)}
            disabled={busy}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !picked}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? t('bidTabMarkAwarded.busy') : t('bidTabMarkAwarded.confirmAction')}
        </button>
        {currentAwardedToBidderName && (
          <button
            type="button"
            onClick={clearAward}
            disabled={busy}
            className="rounded border border-amber-500 bg-white px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {t('bidTabMarkAwarded.clearAward')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setPicked(currentAwardedToBidderName ?? '');
            setAwardedAt(currentAwardedAt ?? '');
            setEditing(false);
            setError(null);
          }}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {t('bidTabMarkAwarded.cancel')}
        </button>
        {error && <span className="text-[11px] text-red-700">⚠ {error}</span>}
      </div>
      <p className="mt-2 text-[10px] text-gray-600">
        {helpPre}
        <em>{t('bidTabMarkAwarded.awardedItalic')}</em>
        {helpPost}
      </p>
    </div>
  );
}
