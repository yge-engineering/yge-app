// /estimates/[id]/coach — pre-submit bid coach report.
//
// Plain English: runs every bid-coach rule against this estimate
// and shows the flags grouped by severity. Danger-level flags block
// submit until they're either fixed or dismissed with a reason. The
// number that lands in this view is the same number the dashboard
// tile reads — both call summarizeBidCoach() against the same flag
// list.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../../../components';
import {
  computeEstimateTotals,
  runBidCoach,
  summarizeBidCoach,
  type BidCoachFlag,
  type BidCoachSeverity,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as FullResponse;
  } catch { return null; }
}

const SEVERITY_TONE: Record<BidCoachSeverity, 'success' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  info: 'info',
  warn: 'warn',
  danger: 'danger',
};

const SEVERITY_LABEL: Record<BidCoachSeverity, string> = {
  info: 'INFO',
  warn: 'WARN',
  danger: 'BLOCK',
};

export default async function BidCoachPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();

  // Recompute totals server-side so the rule input is consistent
  // with what's persisted (the API edge could be stale on the
  // computed-but-not-stored fields).
  const totals = computeEstimateTotals(data.estimate);

  // Phase 1: history + bonding inputs are not wired yet — the
  // outlier + bonding rules silently no-op without them. They light
  // up automatically once the API edge starts supplying the data.
  const flags = runBidCoach({
    estimate: data.estimate,
    totals,
    now: new Date(),
  });
  const report = summarizeBidCoach(flags);

  const danger = flags.filter((f) => f.severity === 'danger' && !f.dismissedAt);
  const warn = flags.filter((f) => f.severity === 'warn' && !f.dismissedAt);
  const info = flags.filter((f) => f.severity === 'info' && !f.dismissedAt);
  const dismissed = flags.filter((f) => !!f.dismissedAt);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/estimates/${data.estimate.id}`}
            className="text-sm text-yge-blue-500 hover:underline"
          >
            &larr; Back to bid
          </Link>
          <span className="text-xs text-gray-500">
            Pre-submit check on {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
          </span>
        </div>

        <PageHeader
          title="Pre-submit check"
          subtitle={`AI bid coach on ${data.estimate.projectName}.`}
        />

        <CoachSummary report={report} />

        {danger.length > 0 && (
          <Section
            title={`Blocking — ${danger.length} item${danger.length === 1 ? '' : 's'}`}
            tone="danger"
            flags={danger}
          />
        )}

        {warn.length > 0 && (
          <Section
            title={`Verify before submit — ${warn.length} item${warn.length === 1 ? '' : 's'}`}
            tone="warn"
            flags={warn}
          />
        )}

        {info.length > 0 && (
          <Section
            title={`Heads-up — ${info.length} item${info.length === 1 ? '' : 's'}`}
            tone="info"
            flags={info}
          />
        )}

        {report.cleanToSubmit && flags.length === 0 && (
          <Alert tone="success" className="mt-6" title="Looks good — clean to submit">
            Every pre-submit rule passed against the bid as it stands. Run this
            check again right before you hit Send if anything changes.
          </Alert>
        )}

        {dismissed.length > 0 && (
          <details className="mt-8 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-gray-700">
              Dismissed earlier — {dismissed.length} item{dismissed.length === 1 ? '' : 's'}
            </summary>
            <div className="mt-3 space-y-2">
              {dismissed.map((f) => (
                <DismissedFlagRow key={f.id} flag={f} />
              ))}
            </div>
          </details>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Phase 1: outlier rule and bonding rule fire only once historical
          unit-price stats and the bonding profile are wired through the
          API. The other four rules run on every estimate today.
        </p>
      </main>
    </AppShell>
  );
}

function CoachSummary({ report }: { report: ReturnType<typeof summarizeBidCoach> }) {
  if (report.activeCount === 0) {
    return (
      <Alert tone="success" className="mt-4" title="Clean to submit">
        No active flags. {report.total > 0 && `${report.total} earlier flag${report.total === 1 ? '' : 's'} dismissed.`}
      </Alert>
    );
  }
  if (report.blockingCount > 0) {
    return (
      <Alert
        tone="danger"
        className="mt-4"
        title={`${report.blockingCount} blocker${report.blockingCount === 1 ? '' : 's'} before this bid can submit`}
      >
        {report.activeCount} active flag{report.activeCount === 1 ? '' : 's'} —{' '}
        {report.blockingCount} blocking,{' '}
        {report.bySeverity.warn} verify, {report.bySeverity.info} heads-up.
        Fix the blockers or dismiss them with a reason before submit.
      </Alert>
    );
  }
  return (
    <Alert tone="warn" className="mt-4" title={`${report.activeCount} item${report.activeCount === 1 ? '' : 's'} to verify before submit`}>
      Nothing is blocking, but read each flag below and confirm the bid still
      reads right before sending.
    </Alert>
  );
}

function Section({
  title,
  tone,
  flags,
}: {
  title: string;
  tone: BidCoachSeverity;
  flags: BidCoachFlag[];
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {title}
      </h2>
      <ul className="space-y-3">
        {flags.map((f) => (
          <li
            key={f.id}
            className={`rounded-md border p-4 ${BORDER[tone]} ${BG[tone]}`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusPill label={SEVERITY_LABEL[f.severity]} tone={SEVERITY_TONE[f.severity]} />
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {f.category}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 font-mono">{f.ruleId}</span>
              {f.bidItemRefId && (
                <>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-700">item {f.bidItemRefId}</span>
                </>
              )}
            </div>
            <div className="font-semibold text-gray-900">{f.title}</div>
            <p className="mt-1 text-sm text-gray-700">{f.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const BORDER: Record<BidCoachSeverity, string> = {
  info: 'border-blue-200',
  warn: 'border-amber-200',
  danger: 'border-red-200',
};
const BG: Record<BidCoachSeverity, string> = {
  info: 'bg-blue-50/60',
  warn: 'bg-amber-50/60',
  danger: 'bg-red-50/60',
};

function DismissedFlagRow({ flag }: { flag: BidCoachFlag }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <StatusPill label={SEVERITY_LABEL[flag.severity]} tone={SEVERITY_TONE[flag.severity]} size="sm" />
        <span className="font-mono">{flag.ruleId}</span>
        <span>·</span>
        <span>dismissed {flag.dismissedAt?.slice(0, 10)}</span>
      </div>
      <div className="font-medium text-gray-700">{flag.title}</div>
      {flag.dismissedReason && (
        <p className="mt-1 text-xs italic text-gray-600">"{flag.dismissedReason}"</p>
      )}
    </div>
  );
}
