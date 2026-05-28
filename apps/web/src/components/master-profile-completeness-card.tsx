// Master profile completeness scorecard — visual progress bar per
// section + overall percent.
//
// Plain English: this is the "you're at 73% complete — fill in
// bonding + insurance to finish" card. Drives Brook/Ryan from
// the static seed defaults to a real populated profile that
// flips /go-live's master-profile readiness row from amber to
// green.
//
// Pure presentational: takes a MasterProfile, runs it through
// the computeMasterProfileCompleteness helper, and renders the
// per-section bars + overall summary.

import {
  computeMasterProfileCompleteness,
  type MasterProfile,
} from '@yge/shared';

interface Props {
  profile: MasterProfile;
}

export function MasterProfileCompletenessCard({ profile }: Props) {
  const report = computeMasterProfileCompleteness(profile);

  // Pick a tone for the overall banner based on overallPercent.
  const tone: 'critical' | 'warn' | 'partial' | 'ready' =
    report.overallPercent === 100
      ? 'ready'
      : report.overallPercent >= 75
        ? 'partial'
        : report.overallPercent >= 40
          ? 'warn'
          : 'critical';
  const overallCls =
    tone === 'ready'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : tone === 'partial'
        ? 'border-blue-300 bg-blue-50 text-blue-900'
        : tone === 'warn'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-red-300 bg-red-50 text-red-900';

  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Profile completeness
      </h2>
      <p className="mt-1 text-[11px] text-gray-500">
        Tracks which sections are filled in. Hitting 100% on bonding +
        insurance flips the /go-live readiness row from amber to green.
      </p>

      <div className={`mt-3 rounded-md border p-3 ${overallCls}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-bold">
            Overall {report.overallPercent}%
          </div>
          <div className="text-xs font-semibold">
            {report.completeSectionCount} of {report.sections.length} sections complete
            {report.emptySectionCount > 0 && ` · ${report.emptySectionCount} empty`}
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/60">
          <div
            className={`h-full rounded-full ${barColorForTone(tone)}`}
            style={{ width: `${report.overallPercent}%` }}
            aria-label={`${report.overallPercent} percent complete`}
            role="progressbar"
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {report.sections.map((s) => (
          <li key={s.key} className="grid grid-cols-[1fr_auto] items-baseline gap-2">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{s.label}</span>
                <span className="font-mono text-[11px] text-gray-500">
                  {s.filledCount}/{s.requiredCount}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full ${barColorForPercent(s.percent)}`}
                  style={{ width: `${s.percent}%` }}
                />
              </div>
            </div>
            <span
              className={`whitespace-nowrap font-mono text-xs ${
                s.percent === 100
                  ? 'text-emerald-700'
                  : s.percent === 0
                    ? 'text-red-700'
                    : 'text-amber-700'
              }`}
            >
              {s.percent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function barColorForTone(
  tone: 'critical' | 'warn' | 'partial' | 'ready',
): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-500';
    case 'partial':
      return 'bg-blue-500';
    case 'warn':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
}

function barColorForPercent(percent: number): string {
  if (percent === 100) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-blue-500';
  if (percent > 0) return 'bg-amber-500';
  return 'bg-red-400';
}
