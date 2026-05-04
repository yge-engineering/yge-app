'use client';

// Bid result editor — bidder list + outcome + meta fields. PATCH on
// blur for free-text; bidder add/remove triggers an immediate save.
//
// When outcome flips to WON_BY_YGE or WON_BY_OTHER, the API auto-
// advances the linked Job's pursuit status.

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  bidOutcomeLabel,
  formatUSD,
  sortBidders,
  winningAmountCents,
  ygeBid,
  ygeDeltaToEngineerEstimateCents,
  ygeDeltaToWinnerCents,
  ygeRank,
  type BidOutcome,
  type BidResult,
  type BidResultBidder,
  type Job,
} from '@yge/shared';

const OUTCOMES: BidOutcome[] = ['TBD', 'WON_BY_YGE', 'WON_BY_OTHER', 'NO_AWARD'];

interface Props {
  initial: BidResult;
  job: Job | undefined;
  apiBaseUrl: string;
}

export function BidResultEditor({ initial, job, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [r, setR] = useState<BidResult>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free-form mirrors.
  const [bidOpenedAt, setBidOpenedAt] = useState(r.bidOpenedAt);
  const [awardedAt, setAwardedAt] = useState(r.awardedAt ?? '');
  const [bidTabUrl, setBidTabUrl] = useState(r.bidTabulationUrl ?? '');
  const [engEstStr, setEngEstStr] = useState(
    r.engineersEstimateCents !== undefined
      ? (r.engineersEstimateCents / 100).toFixed(2)
      : '',
  );
  const [notes, setNotes] = useState(r.notes ?? '');

  // New-bidder form.
  const [newBidderName, setNewBidderName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newIsYge, setNewIsYge] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/bid-results/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('bidResult.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { result: BidResult };
      setR(json.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bidResult.errSave'));
    } finally {
      setSaving(false);
    }
  }

  function saveMeta() {
    void patch({
      bidOpenedAt,
      awardedAt: awardedAt.trim() || undefined,
      bidTabulationUrl: bidTabUrl.trim() || undefined,
      engineersEstimateCents: engEstStr.trim()
        ? Math.round(Number(engEstStr) * 100)
        : undefined,
      notes: notes.trim() || undefined,
    });
  }

  function addBidder() {
    const amt = Math.round(Number(newAmount) * 100);
    if (!newBidderName.trim() || !Number.isFinite(amt) || amt < 0) {
      setError(t('bidResult.errBidderRequired'));
      return;
    }
    const next: BidResultBidder = {
      bidderName: newBidderName.trim(),
      amountCents: amt,
      isYge: newIsYge,
    };
    void patch({ bidders: [...r.bidders, next] });
    setNewBidderName('');
    setNewAmount('');
    setNewIsYge(false);
  }

  function removeBidder(i: number) {
    void patch({ bidders: r.bidders.filter((_, idx) => idx !== i) });
  }

  function toggleYge(i: number) {
    void patch({
      bidders: r.bidders.map((b, idx) =>
        // Make this bidder the YGE one and clear the flag from anyone else.
        idx === i ? { ...b, isYge: !b.isYge } : { ...b, isYge: false },
      ),
    });
  }

  const sorted = sortBidders(r.bidders);
  const yge = ygeBid(r);
  const win = winningAmountCents(r);
  const rank = ygeRank(r);
  const dWin = ygeDeltaToWinnerCents(r);
  const dEng = ygeDeltaToEngineerEstimateCents(r);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yge-blue-500">
            {job?.projectName ?? r.jobId}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('bidResult.subtitle', { date: r.bidOpenedAt })}
            {r.awardedAt && (
              <>
                {t('bidResult.awardedSuffix', { date: r.awardedAt })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={r.outcome}
            onChange={(e) => void patch({ outcome: e.target.value as BidOutcome })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {bidOutcomeLabel(o)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('bidResult.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Quick stats */}
      {yge && (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={t('bidResult.statYge')}
            value={formatUSD(yge.amountCents)}
            subtitle={rank ? t('bidResult.rankOf', { rank, total: r.bidders.length }) : undefined}
          />
          <Stat
            label={t('bidResult.statWin')}
            value={win !== undefined ? formatUSD(win) : '—'}
            subtitle={
              dWin !== undefined && dWin > 0
                ? t('bidResult.ygePlus', { amount: formatUSD(dWin) })
                : dWin === 0
                  ? t('bidResult.ygeWinner')
                  : undefined
            }
          />
          <Stat
            label={t('bidResult.statEng')}
            value={r.engineersEstimateCents ? formatUSD(r.engineersEstimateCents) : '—'}
            subtitle={
              dEng !== undefined
                ? dEng < 0
                  ? t('bidResult.ygeUnder', { amount: formatUSD(dEng) })
                  : t('bidResult.ygeOver', { amount: formatUSD(dEng) })
                : undefined
            }
          />
        </section>
      )}

      {/* Meta */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('bidResult.lblBidOpen')}>
          <input
            type="date"
            value={bidOpenedAt}
            onChange={(e) => setBidOpenedAt(e.target.value)}
            onBlur={saveMeta}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('bidResult.lblAwarded')}>
          <input
            type="date"
            value={awardedAt}
            onChange={(e) => setAwardedAt(e.target.value)}
            onBlur={saveMeta}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('bidResult.lblEngEst')}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={engEstStr}
            onChange={(e) => setEngEstStr(e.target.value)}
            onBlur={saveMeta}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('bidResult.lblBidTabUrl')}>
          <input
            value={bidTabUrl}
            onChange={(e) => setBidTabUrl(e.target.value)}
            onBlur={saveMeta}
            placeholder={t('bidResult.phBidTabUrl')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Bidder list */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('bidResult.bidders')}</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('bidResult.lblName')}>
              <input
                value={newBidderName}
                onChange={(e) => setNewBidderName(e.target.value)}
                placeholder={t('bidResult.phName')}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('bidResult.lblAmount')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('bidResult.lblIsYge')}>
              <div className="flex h-9 items-center">
                <input
                  type="checkbox"
                  checked={newIsYge}
                  onChange={(e) => setNewIsYge(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={addBidder}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                {t('bidResult.addBidder')}
              </button>
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('bidResult.empty')}</p>
        ) : (
          <ol className="mt-4 divide-y divide-gray-100 rounded border border-gray-200 bg-white">
            {sorted.map((b, i) => {
              const originalIdx = r.bidders.indexOf(b);
              return (
                <li
                  key={originalIdx}
                  className={`flex items-center justify-between px-4 py-2 ${b.isYge ? 'bg-yge-blue-50' : ''}`}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {i + 1}. {b.bidderName}
                      {b.isYge && (
                        <span className="ml-2 inline-block rounded bg-yge-blue-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          YGE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatUSD(b.amountCents)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleYge(originalIdx)}
                      className="text-yge-blue-500 hover:underline"
                    >
                      {b.isYge ? t('bidResult.unmarkYge') : t('bidResult.markYge')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBidder(originalIdx)}
                      className="text-red-600 hover:underline"
                    >
                      {t('bidResult.remove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <Field label={t('bidResult.lblNotes')}>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveMeta}
            placeholder={t('bidResult.phNotes')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 text-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-yge-blue-500">{value}</div>
      {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
