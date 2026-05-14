import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Flag { key: string; description: string; state: 'on' | 'off' | 'rollout' }

const FLAGS: Flag[] = [
  { key: 'p2e.enableAutoCommit', description: 'Allow Plans-to-Estimate AI to commit estimate edits without human review.', state: 'off' },
  { key: 'bidResults.sendToS4104', description: 'Show the "send awarded results to §4104" button on bid result detail.', state: 'off' },
  { key: 'mobile.experimentalLayout', description: 'Try the new mobile-first layout for the dashboard.', state: 'off' },
  { key: 'ai.bidLetterDraft', description: 'Enable AI-drafted bid letters (cover letter + bid summary).', state: 'off' },
  { key: 'vendors.scorecardV2', description: 'Switch the vendor scorecard to the redesigned V2 layout.', state: 'rollout' },
];

const TONE: Record<Flag['state'], string> = {
  on: 'bg-green-100 text-green-800',
  off: 'bg-gray-200 text-gray-700',
  rollout: 'bg-amber-100 text-amber-800',
};

export default function FeatureFlagsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Feature flags" subtitle="Roadmap of flagged features. Read-only — flips happen in env, not in the UI." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {FLAGS.map((f) => (
            <li key={f.key} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-3">
              <span className="font-mono text-xs text-gray-900 md:w-1/3">{f.key}</span>
              <span className="text-xs text-gray-600 md:flex-1">{f.description}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TONE[f.state]}`}>
                {f.state}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          When the real flag service ships this page will pull live state from /api/admin/feature-flags.
        </p>
      </main>
    </AppShell>
  );
}
