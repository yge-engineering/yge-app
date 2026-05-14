import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ImportedListClient } from './imported-list-client';

export default function ImportedDailyReportsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Imported daily reports" subtitle="Reports loaded from the YGE Excel job-cost system." />
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/imported-daily-reports/export.csv`}
            download
            className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
          >
            Export all to CSV
          </a>
          <Link
            href="/daily-reports/range"
            className="rounded border border-yge-blue-500 px-3 py-1.5 font-medium text-yge-blue-700 hover:bg-yge-blue-50"
          >
            Date range view →
          </Link>
        </div>
        <ImportedListClient />
      </main>
    </AppShell>
  );
}
