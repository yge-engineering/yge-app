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
import { getTranslator, type Translator } from '../../../../lib/locale';

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

// SEVERITY_LABEL is locale-aware — see severityLabel() inside the page.

export default async function BidCoachPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
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
            {t('coachPg.back')}
          </Link>
          <span className="text-xs text-gray-500">
            {t('coachPg.checkAt', { time: new Date().toISOString().slice(0, 16).replace('T', ' ') })}
          </span>
        </div>

        <PageHeader
          title={t('coachPg.title')}
          subtitle={t('coachPg.subtitle', { project: data.estimate.projectName })}
        />

        <CoachSummary report={report} t={t} />

        {danger.length > 0 && (
          <Section
            title={danger.length === 1
              ? t('coachPg.blockingOne', { count: danger.length })
              : t('coachPg.blockingMany', { count: danger.length })}
            tone="danger"
            flags={danger}
            t={t}
          />
        )}

        {warn.length > 0 && (
          <Section
            title={warn.length === 1
              ? t('coachPg.verifyOne', { count: warn.length })
              : t('coachPg.verifyMany', { count: warn.length })}
            tone="warn"
            flags={warn}
            t={t}
          />
        )}

        {info.length > 0 && (
          <Section
            title={info.length === 1
              ? t('coachPg.headsUpOne', { count: info.length })
              : t('coachPg.headsUpMany', { count: info.length })}
            tone="info"
            flags={info}
            t={t}
          />
        )}

        {report.cleanToSubmit && flags.length === 0 && (
          <Alert tone="success" className="mt-6" title={t('coachPg.cleanTitle')}>
            {t('coachPg.cleanBody')}
          </Alert>
        )}

        {dismissed.length > 0 && (
          <details className="mt-8 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-gray-700">
              {dismissed.length === 1
                ? t('coachPg.dismissedOne', { count: dismissed.length })
                : t('coachPg.dismissedMany', { count: dismissed.length })}
            </summary>
            <div className="mt-3 space-y-2">
              {dismissed.map((f) => (
                <DismissedFlagRow key={f.id} flag={f} t={t} />
              ))}
            </div>
          </details>
        )}

        <p className="mt-8 text-xs text-gray-500">
          {t('coachPg.phase1Note')}
        </p>
      </main>
    </AppShell>
  );
}

function CoachSummary({ report, t }: { report: ReturnType<typeof summarizeBidCoach>; t: Translator }) {
  if (report.activeCount === 0) {
    return (
      <Alert tone="success" className="mt-4" title={t('coachPg.cleanShortTitle')}>
        {report.total > 0
          ? (report.total === 1
              ? t('coachPg.noFlagsOne', { count: report.total })
              : t('coachPg.noFlagsMany', { count: report.total }))
          : t('coachPg.noFlagsZero')}
      </Alert>
    );
  }
  if (report.blockingCount > 0) {
    return (
      <Alert
        tone="danger"
        className="mt-4"
        title={report.blockingCount === 1
          ? t('coachPg.blockerTitleOne', { count: report.blockingCount })
          : t('coachPg.blockerTitleMany', { count: report.blockingCount })}
      >
        {t('coachPg.blockerBody', {
          active: report.activeCount,
          activeWord: report.activeCount === 1 ? t('coachPg.flagOne') : t('coachPg.flagMany'),
          blocking: report.blockingCount,
          warn: report.bySeverity.warn,
          info: report.bySeverity.info,
        })}
      </Alert>
    );
  }
  return (
    <Alert tone="warn" className="mt-4" title={report.activeCount === 1
      ? t('coachPg.verifyTitleOne', { count: report.activeCount })
      : t('coachPg.verifyTitleMany', { count: report.activeCount })}>
      {t('coachPg.verifyBody')}
    </Alert>
  );
}

function severityLabel(s: BidCoachSeverity, t: Translator): string {
  if (s === 'info') return t('coachPg.pillInfo');
  if (s === 'warn') return t('coachPg.pillWarn');
  return t('coachPg.pillBlock');
}

function Section({
  title,
  tone,
  flags,
  t,
}: {
  title: string;
  tone: BidCoachSeverity;
  flags: BidCoachFlag[];
  t: Translator;
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
              <StatusPill label={severityLabel(f.severity, t)} tone={SEVERITY_TONE[f.severity]} />
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {f.category}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 font-mono">{f.ruleId}</span>
              {f.bidItemRefId && (
                <>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-700">{t('coachPg.itemRef', { id: f.bidItemRefId })}</span>
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

function DismissedFlagRow({ flag, t }: { flag: BidCoachFlag; t: Translator }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <StatusPill label={severityLabel(flag.severity, t)} tone={SEVERITY_TONE[flag.severity]} size="sm" />
        <span className="font-mono">{flag.ruleId}</span>
        <span>·</span>
        <span>{t('coachPg.dismissedAt', { date: flag.dismissedAt?.slice(0, 10) ?? '' })}</span>
      </div>
      <div className="font-medium text-gray-700">{flag.title}</div>
      {flag.dismissedReason && (
        <p className="mt-1 text-xs italic text-gray-600">"{flag.dismissedReason}"</p>
      )}
    </div>
  );
}
