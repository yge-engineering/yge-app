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

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function MultiPassPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/plans-to-estimate" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Single-pass page
          </Link>
          <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
            Saved drafts &rarr;
          </Link>
        </div>

        <PageHeader
          title="Plans-to-Estimate (multi-pass)"
          subtitle="Three specialized prompts in sequence: title-block reader → bid-schedule parser → spec-extras pass. Each runs against just the text it needs, so it's tighter than a single big prompt and cheaper for large plan sets."
        />

        <Alert tone="info" className="mt-4">
          Paste each section into its own box. The bid-schedule and title-
          block boxes are required; the spec-extras box is optional — when
          empty, the orchestrator skips that pass and returns the bid
          schedule alone. Spec-extras items stitch onto the schedule with
          'X.&lt;n&gt;' itemNumbers so you can spot them at review.
        </Alert>

        <MultiPassPlansToEstimateForm apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
