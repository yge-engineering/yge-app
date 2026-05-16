import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function TwentyTwoFiftyPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bundle 2,250 milestone" subtitle="Another small marker — 2,250 shipped automation bundles since the autopilot started." />
        <section className="space-y-4">
          <div className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center">
            <div className="text-6xl font-extrabold tracking-tighter text-yge-blue-900">2,250</div>
            <p className="mt-2 text-sm text-yge-blue-800">bundles processed through the queue/done pipeline.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/admin/triple-twos" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Bundle 2,222 marker</div>
              <div className="mt-1 text-xs text-gray-600">Previous milestone tile.</div>
            </Link>
            <Link href="/admin/milestones-v2" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Milestones (v2)</div>
              <div className="mt-1 text-xs text-gray-600">Roster of named bundles.</div>
            </Link>
            <Link href="/at-a-glance-totals" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">At-a-glance totals</div>
              <div className="mt-1 text-xs text-gray-600">Bundle-2250's flagship — four master-data totals.</div>
            </Link>
            <Link href="/admin/grand-index" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Grand index</div>
              <div className="mt-1 text-xs text-gray-600">Six-section catalog of every URL.</div>
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">Next stops: 2,300 · 2,500 · 3,000.</p>
        </section>
      </main>
    </AppShell>
  );
}
