// /rates/import — drop a YGE master-rates Excel workbook, preview
// what was parsed, commit on confirmation. Wraps the existing
// /api/admin/excel-import/master-tables endpoint which does the
// parsing + Postgres write — this page is just the UI on top.
//
// Once the rate tables are populated, every Plans-to-Estimate AI
// run automatically prepends a compact YGE rate-book block to the
// user message so unit prices anchor to YGE's actual book instead
// of generic NorCal averages.

import { AppShell, PageHeader } from '../../../components';
import { RateImportClient } from './rate-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function RateImportPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <PageHeader
          title="Import master rates"
          subtitle="Drop YGE's master-rates Excel workbook. The importer parses Cost codes, Labor rates, Equipment rates, Equipment rental, and Materials sheets, shows a dry-run preview, and commits to Postgres on your confirmation. Once loaded, every AI takeoff anchors unit prices to YGE's book instead of generic NorCal averages."
        />
        <RateImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
