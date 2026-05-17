import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function TwentyThreeHundredPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Bundle 2,300 milestone" subtitle="Another 50 bundles shipped — autopilot still cranking." />
        <section className="space-y-4">
          <div className="rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 text-center">
            <div className="text-6xl font-extrabold tracking-tighter text-yge-blue-900">2,300</div>
            <p className="mt-2 text-sm text-yge-blue-800">
              bundles processed through the queue/done pipeline.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/admin/twenty-two-fifty" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Bundle 2,250 marker</div>
              <div className="mt-1 text-xs text-gray-600">Previous milestone.</div>
            </Link>
            <Link href="/admin/triple-twos" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Bundle 2,222 marker</div>
              <div className="mt-1 text-xs text-gray-600">Triple-twos page.</div>
            </Link>
            <Link href="/admin/print-roster" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Print roster</div>
              <div className="mt-1 text-xs text-gray-600">28+ print-friendly pages added since 2,260.</div>
            </Link>
            <Link href="/at-a-glance-grade" className="rounded border border-gray-200 bg-white p-3 text-sm shadow-sm hover:border-yge-blue-300">
              <div className="font-semibold text-yge-blue-900">Data quality grade</div>
              <div className="mt-1 text-xs text-gray-600">Single A-F grade for master data.</div>
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">Next stops: 2,400 · 2,500 · 3,000.</p>
        </section>
      </main>
    </AppShell>
  );
}
