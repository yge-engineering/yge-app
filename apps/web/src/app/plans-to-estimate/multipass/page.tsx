// /plans-to-estimate/multipass — multi-pass PtoE entry point.
//
// Two-column layout: left is three textareas (title block / bid
// schedule / spec text) + a Run button; right is the rendered
// PtoEOutput once the orchestrator returns. The single-pass page
// at /plans-to-estimate stays for small RFPs where the per-section
// chunking isn't worth the operator time.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
} from '../../../components';
import { MultiPassPlansToEstimateForm } from '@/components/multi-pass-plans-to-estimate-form';
import { getTranslator } from '../../../lib/locale';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function MultiPassPage() {
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/plans-to-estimate" className="text-sm text-yge-blue-500 hover:underline">
            {t('multipassPg.back')}
          </Link>
          <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
            {t('multipassPg.savedDrafts')}
          </Link>
        </div>

        <PageHeader
          title={t('multipassPg.title')}
          subtitle={t('multipassPg.subtitle')}
        />

        <Alert tone="info" className="mt-4">
          {t('multipassPg.infoBlurb')}
        </Alert>

        <MultiPassPlansToEstimateForm apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
