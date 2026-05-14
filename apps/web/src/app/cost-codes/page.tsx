// /cost-codes — master cost code reference list.
//
// Plain English: every code from YGE's Excel master, browsable +
// searchable. The detail UI is intentionally simple — list view with
// search; we don't edit individual codes here yet (re-import via
// scripts/import-from-excel.py is the supported path until edit
// lands).

import type { CostCode } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';
import { CostCodesTable } from './cost-codes-table';
import { CostCodeStatsPanel } from '../../components/cost-code-stats-panel';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCostCodes(): Promise<CostCode[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { costCodes?: CostCode[] };
    return body.costCodes ?? [];
  } catch {
    return [];
  }
}

export default async function CostCodesPage() {
  const codes = await fetchCostCodes();
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Cost codes"
          subtitle={`${codes.length} master code${codes.length === 1 ? '' : 's'} — imported from YGE Excel master`}
        />
        <CostCodeStatsPanel />
        <CostCodesTable codes={codes} />
      </main>
    </AppShell>
  );
}
