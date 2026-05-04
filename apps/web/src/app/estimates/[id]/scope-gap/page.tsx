// /estimates/[id]/scope-gap — AI scope-gap review.
//
// Renders the spec-text input + draft preview side-by-side. Operator
// pastes the technical spec, clicks Run check, and the page POSTs
// to /api/plans-to-estimate/scope-gap. The structured report renders
// below: HIGH gaps first, color-coded, with the spec reference + the
// suggested item shape (item number, description, unit, quantity)
// inline.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  AppShell,
  PageHeader,
} from '../../../../components';
import { ScopeGapForm } from '@/components/scope-gap-form';
import type { PricedEstimate, PricedEstimateTotals } from '@yge/shared';
import { getTranslator } from '../../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as FullResponse;
  } catch { return null; }
}

export default async function ScopeGapPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const data = await fetchEstimate(params.id);
  if (!data) notFound();

  const draftJson = JSON.stringify(
    {
      projectName: data.estimate.projectName,
      projectType: data.estimate.projectType,
      bidItems: data.estimate.bidItems.map((b) => ({
        itemNumber: b.itemNumber,
        description: b.description,
        unit: b.unit,
        quantity: b.quantity,
      })),
      addenda: data.estimate.addenda.map((a) => ({ number: a.number, subject: a.subject })),
    },
    null,
    2,
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/estimates/${data.estimate.id}`}
            className="text-sm text-yge-blue-500 hover:underline"
          >
            {t('coachPg.back')}
          </Link>
        </div>

        <PageHeader
          title={t('scopeGapPg.title')}
          subtitle={t('scopeGapPg.subtitle', { project: data.estimate.projectName })}
        />

        <Alert tone="info" className="mt-4">
          {t('scopeGapPg.infoBlurb', { count: data.estimate.bidItems.length })}
        </Alert>

        <ScopeGapForm
          apiBaseUrl={publicApiBaseUrl()}
          draftJson={draftJson}
          itemCount={data.estimate.bidItems.length}
        />
      </main>
    </AppShell>
  );
}
