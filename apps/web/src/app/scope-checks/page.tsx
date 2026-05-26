// /scope-checks — reference page listing every item the six
// archetype scope guards look for, with the "what to check"
// guidance the banners surface.
//
// Reasoning: when the banner says "✗ Transformer foundations
// missing", Ryan needs to know what counts as "transformer
// foundations" and how to confirm. This page is the
// glossary. Also useful when training a new estimator —
// here's the AI's checklist.
//
// No DB access; pure render of the static lists.

import { AppShell, PageHeader } from '../../components';
import {
  checkBridgeScope,
  checkDrainageScope,
  checkFuelReductionScope,
  checkGradingScope,
  checkRoadReconScope,
  checkSubstationCivilScope,
} from '@yge/shared';

/** Build a "everything is missing" check by feeding the guard
 *  a draft with just the right keyword so it fires + only
 *  a mobilization line so nothing matches. Lets us enumerate
 *  every item the guard knows about. */
function enumerateGuard<T extends { missingItems: ReadonlyArray<{ key: string; label: string; whatToCheck: string }> }>(
  triggerProjectName: string,
  check: (draft: { projectName: string; bidItems: { description: string }[]; projectType?: string }) => T,
): Array<{ key: string; label: string; whatToCheck: string }> {
  const result = check({
    projectName: triggerProjectName,
    bidItems: [{ description: 'Mobilization' }],
  });
  return [...result.missingItems];
}

const ARCHETYPES = [
  {
    key: 'substation',
    title: 'Substation civil',
    blurb:
      'Powerline/Allbaugh pattern — the v1 vision takeoff missed transformer foundations and bid this scope at $814K when actual was $3.1M.',
    tone: 'red' as const,
    triggerProjectName: 'Substation',
    items: enumerateGuard('Substation', checkSubstationCivilScope),
  },
  {
    key: 'road-recon',
    title: 'Road / overlay',
    blurb:
      'Reconstruction, overlay, mill-and-overlay. ADA ramps and traffic control are the most common omissions.',
    tone: 'amber' as const,
    triggerProjectName: 'Road overlay',
    items: enumerateGuard('Road overlay', checkRoadReconScope),
  },
  {
    key: 'drainage',
    title: 'Drainage / storm / culvert',
    blurb:
      'Pipe itself rarely missed; bedding, backfill, headwalls, riprap are the gaps.',
    tone: 'amber' as const,
    triggerProjectName: 'Storm drain',
    items: enumerateGuard('Storm drain', checkDrainageScope),
  },
  {
    key: 'fuel-reduction',
    title: 'Fuel reduction / vegetation management',
    blurb:
      'CAL FIRE specialty. Per-acre prices look round, but slash treatment + burn permits + resource avoidance add up.',
    tone: 'amber' as const,
    triggerProjectName: 'CAL FIRE mastication',
    items: enumerateGuard('CAL FIRE mastication', checkFuelReductionScope),
  },
  {
    key: 'grading',
    title: 'Site grading / mass earthwork',
    blurb:
      'Headline cut/fill dominates the bid; support items (dust control, demo, surveyor) easily missed.',
    tone: 'amber' as const,
    triggerProjectName: 'Mass grading',
    items: enumerateGuard('Mass grading', checkGradingScope),
  },
  {
    key: 'bridge',
    title: 'Bridge',
    blurb:
      'Rare for YGE (subbed out usually). Structural system has many implied items.',
    tone: 'amber' as const,
    triggerProjectName: 'Bridge replacement',
    items: enumerateGuard('Bridge replacement', checkBridgeScope),
  },
];

export default function ScopeChecksPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-6 sm:p-8">
        <PageHeader
          title="Scope check reference"
          subtitle="The 6 archetype guards that run on every draft + priced estimate. When a banner flags an item missing, look here to see what counts and what to look for."
        />

        <div className="mt-6 space-y-6">
          {ARCHETYPES.map((arc) => (
            <section
              key={arc.key}
              className={`rounded-lg border p-4 ${
                arc.tone === 'red'
                  ? 'border-red-300 bg-red-50'
                  : 'border-amber-300 bg-amber-50'
              }`}
            >
              <header>
                <h2
                  className={`text-base font-bold ${
                    arc.tone === 'red' ? 'text-red-900' : 'text-amber-900'
                  }`}
                >
                  {arc.title}
                  <span className="ml-2 text-xs font-normal">
                    {arc.items.length} item{arc.items.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <p
                  className={`mt-1 text-xs ${
                    arc.tone === 'red' ? 'text-red-800' : 'text-amber-800'
                  }`}
                >
                  {arc.blurb}
                </p>
              </header>

              <ul className="mt-3 space-y-2 text-sm">
                {arc.items.map((item) => (
                  <li
                    key={item.key}
                    className={`rounded border bg-white p-2 ${
                      arc.tone === 'red' ? 'border-red-200' : 'border-amber-200'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{item.label}</div>
                    <div className="mt-1 text-xs text-gray-700">{item.whatToCheck}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          The guards run in parallel on every draft and priced estimate.
          Detection is keyword-based, so a job that mentions both
          &quot;substation&quot; and &quot;road overlay&quot; will trip both
          checks. False positives are intentional — better to flag and
          dismiss than to silently omit scope.
        </p>
      </main>
    </AppShell>
  );
}
