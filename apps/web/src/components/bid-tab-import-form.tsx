// Bid-tab manual-import form.
//
// Operator pastes the bidder list (one bidder per line, "Name | $Total"
// or "Name, $Total" or tab-separated) and fills the project metadata
// (agency, project name, bid-open date, source, county). The form
// parses the bidder lines client-side, builds a BidTabCreate, POSTs.
//
// Real per-source HTML scrapers (Caltrans BidExpress, Cal eProcure,
// county portals) layer on top later — they produce the same
// BidTabCreate shape, just programmatically.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '../lib/use-translator';
import {
  BidTabSourceSchema,
  type BidTabSource,
} from '@yge/shared';

interface ParsedBidder {
  name: string;
  totalCents: number;
  raw: string;
  ok: boolean;
}

interface Props {
  apiBaseUrl: string;
}

const SOURCES: ReadonlyArray<BidTabSource> = BidTabSourceSchema.options;

const OWNER_TYPES = [
  'STATE',
  'FEDERAL',
  'COUNTY',
  'CITY',
  'SPECIAL_DISTRICT',
  'TRIBAL',
  'JOINT_POWERS',
  'OTHER_PUBLIC',
] as const;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

function parseBidderLines(raw: string): ParsedBidder[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): ParsedBidder => {
      // Split on tab, |, or comma. The amount is the last numeric-ish chunk.
      const parts = line.split(/\s*[|,\t]\s*/);
      let amount: number | null = null;
      let amountIdx = -1;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const candidate = parseAmount(parts[i]!);
        if (candidate !== null) {
          amount = candidate;
          amountIdx = i;
          break;
        }
      }
      if (amount === null || amountIdx < 0) {
        return { name: line, totalCents: 0, raw: line, ok: false };
      }
      const nameParts = parts.slice(0, amountIdx).filter((p) => p.length > 0);
      const name = nameParts.join(' ').trim();
      if (name.length === 0) {
        return { name: line, totalCents: amount, raw: line, ok: false };
      }
      return { name, totalCents: amount, raw: line, ok: true };
    });
}

export function BidTabImportForm({ apiBaseUrl }: Props) {
  const router = useRouter();
  const t = useTranslator();

  const [source, setSource] = useState<BidTabSource>('CALTRANS');
  const [agencyName, setAgencyName] = useState('');
  const [ownerType, setOwnerType] = useState<typeof OWNER_TYPES[number]>('STATE');
  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [county, setCounty] = useState('');
  const [bidOpenedAt, setBidOpenedAt] = useState('');
  const [engineersEstimate, setEngineersEstimate] = useState('');
  const [biddersRaw, setBiddersRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseBidderLines(biddersRaw);
  const ok = parsed.filter((b) => b.ok).sort((a, b) => a.totalCents - b.totalCents);
  const apparentLow = ok[0];

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    setError(null);
    if (ok.length === 0) {
      setError(t('bidTabImport.errEmpty'));
      return;
    }
    if (!projectName.trim() || !agencyName.trim() || !bidOpenedAt) {
      setError(t('bidTabImport.errRequired'));
      return;
    }
    setBusy(true);
    try {
      const ee = engineersEstimate ? parseAmount(engineersEstimate) : null;
      const body = {
        source,
        agencyName: agencyName.trim(),
        ownerType,
        projectName: projectName.trim(),
        projectNumber: projectNumber.trim() || undefined,
        county: county.trim() || undefined,
        state: 'CA' as const,
        engineersEstimateCents: ee ?? undefined,
        bidOpenedAt,
        scrapedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
        bidders: ok.map((b, i) => ({
          rank: i + 1,
          name: b.name,
          nameNormalized: b.name.toLowerCase(),
          totalCents: b.totalCents,
        })),
      };
      const res = await fetch(`${apiBaseUrl}/api/bid-tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const reply = (await res.json().catch(() => ({}))) as { error?: string };
        setError(reply.error ?? t('bidTabImport.errFail', { status: res.status }));
        return;
      }
      const json = (await res.json()) as { tab: { id: string } };
      router.push(`/bid-tabs/${json.tab.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblSource')}</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as BidTabSource)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblOwnerType')}</span>
          <select
            value={ownerType}
            onChange={(e) => setOwnerType(e.target.value as typeof OWNER_TYPES[number])}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {OWNER_TYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblAgency')}</span>
          <input
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder={t('bidTabImport.phAgency')}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblProject')}</span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder={t('bidTabImport.phProject')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblProjNum')}</span>
          <input
            type="text"
            value={projectNumber}
            onChange={(e) => setProjectNumber(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder={t('bidTabImport.phProjNum')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblCounty')}</span>
          <input
            type="text"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder={t('bidTabImport.phCounty')}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblBidOpened')}</span>
          <input
            type="date"
            value={bidOpenedAt}
            onChange={(e) => setBidOpenedAt(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">
            {t('bidTabImport.lblEngEst')}
          </span>
          <input
            type="text"
            value={engineersEstimate}
            onChange={(e) => setEngineersEstimate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder={t('bidTabImport.phEngEst')}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600">
          {t('bidTabImport.lblBidders')}
        </span>
        <textarea
          value={biddersRaw}
          onChange={(e) => setBiddersRaw(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder={t('bidTabImport.phBidders')}
        />
      </label>

      {biddersRaw.length > 0 && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs">
          <p className="mb-1 text-gray-600">
            {ok.length === 1
              ? t('bidTabImport.parsedOne')
              : t('bidTabImport.parsedMany', { count: ok.length })}
            {parsed.length > ok.length && (
              <span className="ml-2 text-amber-700">
                {parsed.length - ok.length === 1
                  ? t('bidTabImport.unparseableOne')
                  : t('bidTabImport.unparseableMany', { count: parsed.length - ok.length })}
              </span>
            )}
          </p>
          {apparentLow && (() => {
            const tpl = t('bidTabImport.apparentLow', { name: '__NAME__', amount: '__AMT__' });
            const parts = tpl.split('__NAME__');
            const before = parts[0] ?? '';
            const after = (parts[1] ?? '').split('__AMT__');
            const middle = after[0] ?? '';
            const tail = after[1] ?? '';
            return (
              <p className="text-gray-700">
                {before}
                <strong className="font-semibold">{apparentLow.name}</strong>
                {middle}
                <span className="font-mono">${(apparentLow.totalCents / 100).toLocaleString()}</span>
                {tail}
              </p>
            );
          })()}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('bidTabImport.lblNotes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder={t('bidTabImport.phNotes')}
        />
      </label>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
      >
        {busy ? t('bidTabImport.busy') : t('bidTabImport.action')}
      </button>
    </form>
  );
}
