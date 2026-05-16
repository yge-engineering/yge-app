import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function TripleTwosPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bundle 2222 milestone" subtitle="A small marker — 2,222 shipped automation bundles since the autopilot started." />
        <section className="space-y-4">
          <div className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center">
            <div className="text-6xl font-extrabold tracking-tighter text-yge-blue-900">2,222</div>
            <p className="mt-2 text-sm text-yge-blue-800">
              bundles processed through the queue/done pipeline.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/admin/milestones-v2" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Milestones (v2)</div>
              <div className="mt-1 text-xs text-gray-600">Roster of named bundles by hundred-marker.</div>
            </Link>
            <Link href="/admin/cleanup-progress" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Cleanup progress</div>
              <div className="mt-1 text-xs text-gray-600">Where the master-data backlog stands.</div>
            </Link>
            <Link href="/admin/grand-index" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Grand index</div>
              <div className="mt-1 text-xs text-gray-600">Six-section catalog of every URL.</div>
            </Link>
            <Link href="/admin/url-coverage" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">URL coverage</div>
              <div className="mt-1 text-xs text-gray-600">Which page patterns each entity has.</div>
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">
            Crank continues. Next stops: 2,300 · 2,500 · 3,000.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
