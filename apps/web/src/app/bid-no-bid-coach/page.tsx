'use client';

// /bid-no-bid-coach — score a prospective bid 0..100.
//
// Wires bundle 2539. User fills in agency relationship + margin
// expectation + bond fit + resource availability + effort/win-prob
// + strategic factors; page shows the score + verdict + per-factor
// breakdown explaining where the points came from.

import { useMemo, useState } from 'react';

import {
  BidNoBidInputSchema,
  scoreBidNoBid,
  type BidNoBidInput,
  type BidNoBidVerdict,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

const VERDICT_TONE: Record<BidNoBidVerdict, string> = {
  BID: 'bg-green-100 text-green-900',
  LEAN_BID: 'bg-green-50 text-green-900',
  TOSS_UP: 'bg-amber-100 text-amber-900',
  LEAN_NO_BID: 'bg-orange-100 text-orange-900',
  NO_BID: 'bg-red-100 text-red-900',
};

export default function BidNoBidCoachPage() {
  const [priorWinsCount, setPriorWinsCount] = useState('3');
  const [priorDisputesCount, setPriorDisputesCount] = useState('0');
  const [expectedMarginPct, setExpectedMarginPct] = useState('12');
  const [marginFloorPct, setMarginFloorPct] = useState('8');
  const [bondUtilPct, setBondUtilPct] = useState('60');
  const [exceedsSingleJobBondCap, setExceedsCap] = useState(false);
  const [crewAvailability, setCrewAvailability] = useState('80');
  const [equipmentAvailability, setEquipmentAvailability] = useState('80');
  const [bidPrepHoursEstimate, setBidPrepHours] = useState('20');
  const [estimatedWinProbability, setWinProb] = useState('45');
  const [strategicNewAgency, setStrategic] = useState(false);

  const result = useMemo(() => {
    const raw: BidNoBidInput = {
      priorWinsCount: Math.max(0, Number(priorWinsCount) || 0),
      priorDisputesCount: Math.max(0, Number(priorDisputesCount) || 0),
      expectedMarginPct: (Number(expectedMarginPct) || 0) / 100,
      marginFloorPct: (Number(marginFloorPct) || 0) / 100,
      bondAggregateUtilizationIfWon: Math.max(0, (Number(bondUtilPct) || 0) / 100),
      exceedsSingleJobBondCap,
      crewAvailability: Math.max(0, Math.min(1, (Number(crewAvailability) || 0) / 100)),
      equipmentAvailability: Math.max(0, Math.min(1, (Number(equipmentAvailability) || 0) / 100)),
      bidPrepHoursEstimate: Math.max(0, Number(bidPrepHoursEstimate) || 0),
      estimatedWinProbability: Math.max(0, Math.min(1, (Number(estimatedWinProbability) || 0) / 100)),
      strategicNewAgency,
    };
    const parsed = BidNoBidInputSchema.safeParse(raw);
    return parsed.success ? scoreBidNoBid(parsed.data) : null;
  }, [
    priorWinsCount,
    priorDisputesCount,
    expectedMarginPct,
    marginFloorPct,
    bondUtilPct,
    exceedsSingleJobBondCap,
    crewAvailability,
    equipmentAvailability,
    bidPrepHoursEstimate,
    estimatedWinProbability,
    strategicNewAgency,
  ]);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Bid / no-bid coach"
          subtitle="Quick numeric verdict for a prospective bid. Score 0–100, verdict from BID to NO_BID, plus the per-factor breakdown so you know WHY."
        />

        {result && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Score" value={`${result.score} / 100`} />
            <div
              className={`flex items-center justify-center rounded-lg border border-gray-200 p-4 text-2xl font-bold ${VERDICT_TONE[result.verdict]}`}
            >
              {result.verdict.replace('_', ' ')}
            </div>
            <Tile label="Factors above 0" value={String(result.factors.filter((f) => f.delta > 0).length)} />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Inputs</h2>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Agency relationship</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prior wins">
                <input value={priorWinsCount} onChange={(e) => setPriorWinsCount(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Prior disputes">
                <input value={priorDisputesCount} onChange={(e) => setPriorDisputesCount(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Margin</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expected margin (%)">
                <input value={expectedMarginPct} onChange={(e) => setExpectedMarginPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Margin floor (%)">
                <input value={marginFloorPct} onChange={(e) => setMarginFloorPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Bonding</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aggregate util after win (%)">
                <input value={bondUtilPct} onChange={(e) => setBondUtilPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <label className="mt-3 flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={exceedsSingleJobBondCap}
                  onChange={(e) => setExceedsCap(e.target.checked)}
                />
                <span>Exceeds single-job bond cap</span>
              </label>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Resource fit</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Crew availability (%)">
                <input value={crewAvailability} onChange={(e) => setCrewAvailability(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Equipment availability (%)">
                <input value={equipmentAvailability} onChange={(e) => setEquipmentAvailability(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Effort + probability</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bid prep hours">
                <input value={bidPrepHoursEstimate} onChange={(e) => setBidPrepHours(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Win probability (%)">
                <input value={estimatedWinProbability} onChange={(e) => setWinProb(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <label className="mt-3 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={strategicNewAgency}
                onChange={(e) => setStrategic(e.target.checked)}
              />
              <span>Strategic — winning opens a new agency relationship</span>
            </label>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Why this score</h2>
            {result ? (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2">Factor</th>
                    <th className="py-2 text-right">Δ</th>
                    <th className="py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {result.factors.map((f, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="py-2 text-gray-900">{f.label}</td>
                      <td
                        className={`py-2 text-right font-mono font-semibold ${
                          f.delta < 0 ? 'text-red-700' : f.delta > 0 ? 'text-green-700' : 'text-gray-500'
                        }`}
                      >
                        {f.delta > 0 ? '+' : ''}
                        {f.delta}
                      </td>
                      <td className="py-2 text-xs text-gray-600">{f.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-600">Adjust the inputs to see the score.</p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
