import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const SAMPLES: string[] = [
  'No customers in the database yet.',
  'No vendors in the database yet.',
  'No employees in the database yet.',
  'No jobs in the database yet.',
  'No bid results recorded yet.',
  'No imported estimates yet.',
  'No daily reports recorded yet.',
  'Every customer has an email. Nice.',
  'Every vendor has a phone number. Nice.',
  'Every job has a status. Nice.',
  'No NO_BID jobs on file.',
  'No recorded YGE wins yet.',
  'No close-miss data yet.',
  'No competitor data yet.',
  'No apparent-low bids recorded yet.',
];

export default function EmptyStateGalleryPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Empty-state gallery" subtitle="Every empty-state copy used in the YGE app, for tone + brevity review." />
        <ul className="space-y-2">
          {SAMPLES.map((s, i) => (
            <li key={i} className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">
              {s}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
