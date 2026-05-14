import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function QuickLookPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Quick look" subtitle="Short prose summary of what the app does." />

        <div className="space-y-3 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
          <p>
            The YGE app is the bookkeeping + estimating + job-management platform for{' '}
            <span className="font-semibold">Young General Engineering, Inc.</span>
            {' '}It replaces the prior Excel + QuickBooks Online setup with one source of truth.
          </p>
          <p>
            Most pages fall into one of four buckets:
          </p>
          <ul className="ml-6 list-disc">
            <li><b>Master data</b> — customers, vendors, employees, materials, equipment, labor rates, cost codes.</li>
            <li><b>Estimating</b> — imported estimates, bid results, pipeline tracking.</li>
            <li><b>Reporting</b> — analytic and group-by views (by year / quarter / month / week / day / state / kind / agency / status / rate type), plus data-quality cleanup views.</li>
            <li><b>Admin</b> — CSV imports / exports, health checks, build info, scheduled-task roadmap, role-based access.</li>
          </ul>
          <p>
            Start at{' '}
            <Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link>,{' '}
            <Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link>, or{' '}
            <Link href="/sitemap" className="text-yge-blue-700 hover:underline">/sitemap</Link>.
          </p>
        </div>
      </main>
    </AppShell>
  );
}
