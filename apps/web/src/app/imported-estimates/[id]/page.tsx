// /imported-estimates/[id] — detail view with Excel-style inline
// editing.
//
// Server component fetches the estimate + the master cost-code list
// (so the cost-code column can suggest from + auto-fill description),
// then hands both to the client EstimateDetail component.

import { notFound } from 'next/navigation';
import type { CostCode, ImportedEstimate } from '@yge/shared';

import { AppShell } from '../../../components';
import { EstimateDetail } from './estimate-detail';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEstimate(id: string): Promise<ImportedEstimate | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/imported-estimates/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { importedEstimate?: ImportedEstimate };
    return body.importedEstimate ?? null;
  } catch {
    return null;
  }
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

export default async function ImportedEstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [estimate, costCodes] = await Promise.all([
    fetchEstimate(params.id),
    fetchCostCodes(),
  ]);
  if (!estimate) notFound();
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <EstimateDetail initial={estimate} costCodes={costCodes} />
      </main>
    </AppShell>
  );
}
