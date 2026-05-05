// /imported-estimates/[id] — detail view with edit / add-line /
// delete-line / edit-project-info modals.
//
// Server component fetches the estimate then hands it to the client
// EstimateDetail component which manages all edit state.

import { notFound } from 'next/navigation';
import type { ImportedEstimate } from '@yge/shared';

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

export default async function ImportedEstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const estimate = await fetchEstimate(params.id);
  if (!estimate) notFound();
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <EstimateDetail initial={estimate} />
      </main>
    </AppShell>
  );
}
