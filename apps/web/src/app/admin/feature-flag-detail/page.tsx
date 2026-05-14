import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Flag { key: string; description: string; intendedAudience: string; status: string }

const FLAGS: Flag[] = [
  {
    key: 'p2e.enableAutoCommit',
    description: 'Allow Plans-to-Estimate AI to commit estimate edits without human review.',
    intendedAudience: 'Internal R&D only — never enable in production until accuracy paired-data hits 95%+.',
    status: 'off',
  },
  {
    key: 'bidResults.sendToS4104',
    description: 'Show the "send awarded results to §4104" button on bid result detail. Generates the PCC §4104 subcontractor list PDF.',
    intendedAudience: 'YGE estimators on awarded public-works bids.',
    status: 'off',
  },
  {
    key: 'mobile.experimentalLayout',
    description: 'Try the new mobile-first layout for the dashboard and job-detail pages.',
    intendedAudience: 'Foremen and field staff on phones.',
    status: 'off',
  },
  {
    key: 'ai.bidLetterDraft',
    description: 'Enable AI-drafted bid letters (cover letter + bid summary) from imported estimates.',
    intendedAudience: 'Estimators sending bid packages.',
    status: 'off',
  },
  {
    key: 'vendors.scorecardV2',
    description: 'Switch the vendor scorecard to the redesigned V2 layout with rolling 12-month KPIs.',
    intendedAudience: 'Office staff reviewing subs.',
    status: 'rollout',
  },
  {
    key: 'cpr.autoGenPwc100',
    description: 'Auto-generate PWC-100 CPRs each Friday from the week\'s timecards.',
    intendedAudience: 'Office payroll staff on PW jobs.',
    status: 'planned',
  },
  {
    key: 'portal.subView',
    description: 'External portal that lets subcontractors see their own POs + lien waivers + COI status.',
    intendedAudience: 'External subs.',
    status: 'planned',
  },
];

const TONE: Record<string, string> = {
  on: 'bg-green-100 text-green-800',
  off: 'bg-gray-200 text-gray-700',
  rollout: 'bg-amber-100 text-amber-800',
  planned: 'bg-blue-100 text-blue-800',
};

export default function FeatureFlagDetailPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Feature flag detail" subtitle="What each planned flag does + who it's for + current status." />
        <ul className="space-y-3">
          {FLAGS.map((f) => (
            <li key={f.key} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-gray-900">{f.key}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TONE[f.status] ?? 'bg-gray-100 text-gray-700'}`}>{f.status}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{f.description}</p>
              <p className="mt-1 text-xs text-gray-500">Audience: {f.intendedAudience}</p>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
