// Compact one-line tile for master profile completeness.
//
// Companion to MasterProfileCompletenessCard (the full per-section
// scorecard on /master-profile). This tile is the "at a glance"
// version for dashboards + the go-live page: shows the overall
// percent + names the emptiest section so Brook/Ryan know exactly
// where to click first.
//
// Server-rendered — fetches the master profile on the server, runs
// computeMasterProfileCompleteness, and renders the result. Returns
// null when the API can't be reached or no profile exists, so
// callers can drop it into any layout without a fallback story.

import Link from 'next/link';

import {
  computeMasterProfileCompleteness,
  type MasterProfile,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MasterProfile }).profile;
  } catch {
    return null;
  }
}

export async function MasterProfileCompletenessTile() {
  const profile = await fetchProfile();
  if (!profile) return null;

  const report = computeMasterProfileCompleteness(profile);
  const tone =
    report.overallPercent === 100
      ? 'ready'
      : report.overallPercent >= 75
        ? 'partial'
        : report.overallPercent >= 40
          ? 'warn'
          : 'critical';

  const cls =
    tone === 'ready'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : tone === 'partial'
        ? 'border-blue-300 bg-blue-50 text-blue-900'
        : tone === 'warn'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-red-300 bg-red-50 text-red-900';

  // Lowest-percent section that's not already at 100% — names the
  // next click target so the tile is actionable.
  const incomplete = report.sections
    .filter((s) => s.percent < 100)
    .sort((a, b) => a.percent - b.percent);
  const nextSection = incomplete[0];

  return (
    <Link
      href="/master-profile"
      className={`mt-4 block rounded-md border p-4 shadow-sm hover:opacity-90 ${cls}`}
      title="Open /master-profile to keep filling in fields"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          Master profile completeness
        </h2>
        <span className="font-mono text-lg font-bold">
          {report.overallPercent}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
        <div
          className={`h-full ${
            tone === 'ready'
              ? 'bg-emerald-500'
              : tone === 'partial'
                ? 'bg-blue-500'
                : tone === 'warn'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
          }`}
          style={{ width: `${report.overallPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs">
        {report.completeSectionCount} of {report.sections.length} sections complete
        {nextSection &&
          report.overallPercent < 100 &&
          ` · next: ${nextSection.label} (${nextSection.filledCount}/${nextSection.requiredCount})`}
      </p>
    </Link>
  );
}
