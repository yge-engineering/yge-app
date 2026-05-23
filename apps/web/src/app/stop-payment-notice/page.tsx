'use client';

import { useState } from 'react';
import { AppShell, Money, PageHeader, StatusPill, Tile } from '../../components';
import {
  buildStopPaymentNotice,
  StopPaymentInputSchema,
  type StopPaymentResult,
} from '@yge/shared';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StopPaymentNoticePage() {
  const [claimantName, setClaimantName] = useState('Young General Engineering, Inc.');
  const [claimantAddress, setClaimantAddress] = useState('19645 Little Woods Rd, Cottonwood CA 96022');
  const [hiringPartyName, setHiringPartyName] = useState('');
  const [primeContractorName, setPrimeContractorName] = useState('');
  const [publicAgencyName, setPublicAgencyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [amountClaimed, setAmountClaimed] = useState('');
  const [lastWorkDate, setLastWorkDate] = useState('');
  const [today, setToday] = useState(todayIso());
  const [result, setResult] = useState<StopPaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function compute() {
    setError(null);
    const cents = Math.round(Number(amountClaimed) * 100);
    if (!cents || cents <= 0) {
      setError('Amount claimed must be positive.');
      return;
    }
    const parsed = StopPaymentInputSchema.safeParse({
      claimantName,
      claimantAddress,
      hiringPartyName,
      primeContractorName,
      publicAgencyName,
      projectName,
      projectLocation: projectLocation || undefined,
      workDescription,
      amountClaimedCents: cents,
      lastWorkDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the inputs.');
      return;
    }
    setResult(buildStopPaymentNotice(parsed.data, today));
  }

  function copyNotice() {
    if (!result) return;
    navigator.clipboard.writeText(result.noticeText).catch(() => {});
  }

  function downloadNotice() {
    if (!result) return;
    const blob = new Blob([result.noticeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stop-payment-notice-${projectName.replace(/[^\w.-]+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const tone =
    result == null
      ? 'neutral'
      : result.daysUntilDeadline < 0
        ? 'danger'
        : result.daysUntilDeadline <= 30
          ? 'warn'
          : 'success';

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <PageHeader
          title="Stop-payment notice"
          subtitle="CA Civ. Code §9350+: sub-tier mechanism to freeze the prime's retention on a public-works job. Must be served on the agency within 90 days of completion. Agency must withhold 125% of the claim."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Claimant + parties</h2>
            <div className="space-y-3 text-sm">
              <Field label="Claimant name">
                <input value={claimantName} onChange={(e) => setClaimantName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Claimant address">
                <input value={claimantAddress} onChange={(e) => setClaimantAddress(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Hiring party">
                <input value={hiringPartyName} onChange={(e) => setHiringPartyName(e.target.value)} placeholder="Who hired you (prime or upper sub)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Prime contractor">
                <input value={primeContractorName} onChange={(e) => setPrimeContractorName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Public agency">
                <input value={publicAgencyName} onChange={(e) => setPublicAgencyName(e.target.value)} placeholder="CAL FIRE, Caltrans, county, city…" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Project + claim</h2>
            <div className="space-y-3 text-sm">
              <Field label="Project name">
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Project location (optional)">
                <input value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Work description">
                <textarea rows={3} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="Brief: grading, materials supplied, services performed, etc." className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount claimed ($)">
                  <input type="number" step="0.01" min="0" value={amountClaimed} onChange={(e) => setAmountClaimed(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </Field>
                <Field label="Last work date">
                  <input type="date" value={lastWorkDate} onChange={(e) => setLastWorkDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Today (for status)">
                <input type="date" value={today} onChange={(e) => setToday(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={compute}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
          >
            Generate notice
          </button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>

        {result ? (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <Tile label="Amount claimed" value={<Money cents={Math.round(Number(amountClaimed) * 100)} />} />
              <Tile label="Agency must withhold (125%)" value={<Money cents={result.withholdAmountCents} />} />
              <Tile
                label="Serve by"
                value={
                  <div>
                    <div className="font-mono text-base">{result.serveByDate}</div>
                    <div className="mt-1">
                      <StatusPill
                        label={
                          result.daysUntilDeadline < 0
                            ? `${Math.abs(result.daysUntilDeadline)} days PAST`
                            : `${result.daysUntilDeadline} days left`
                        }
                        tone={tone === 'success' || tone === 'warn' || tone === 'danger' ? tone : 'neutral'}
                      />
                    </div>
                  </div>
                }
              />
            </section>

            <section className="mt-4 rounded border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
                <span className="text-sm font-semibold text-gray-700">Notice text</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyNotice}
                    className="rounded border border-gray-300 bg-white px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    📋 Copy
                  </button>
                  <button
                    type="button"
                    onClick={downloadNotice}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    ⬇ Download .txt
                  </button>
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs text-gray-900">
                {result.noticeText}
              </pre>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
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
