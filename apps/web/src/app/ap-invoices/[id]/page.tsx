// /ap-invoices/[id] — full editor with line items + approve / pay / reject.

import Link from 'next/link';

import {
  ApReextractButton,
  AppShell,
  AuditBinderPanel,
} from '../../../components';
import { notFound } from 'next/navigation';
import type { ApInvoice, Job } from '@yge/shared';
import { ApInvoiceEditor } from '@/components/ap-invoice-editor';
import { ApInvoiceStatusBar } from '@/components/ap-invoice-status-bar';
import { PostToGlButton } from '@/components/post-to-gl-button';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchInvoice(id: string): Promise<ApInvoice | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/ap-invoices/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { invoice: ApInvoice }).invoice;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function ApInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [invoice, jobs] = await Promise.all([fetchInvoice(params.id), fetchJobs()]);
  if (!invoice) notFound();
  const t = getTranslator();

  // Surface AI-extraction provenance from the notes (the AP inbox
  // poller stamps these markers when Claude pre-filled the row).
  const notes = invoice.notes ?? '';
  const aiHeader = notes.match(/AI extraction \(([^)]*confidence (HIGH|MEDIUM|LOW))\)/i);
  const aiConfidence = aiHeader?.[2];
  const reviewerNote = notes.match(/^Reviewer note: (.+)$/m)?.[1]?.trim();

  return (
    <AppShell>
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/ap-invoices" className="text-sm text-yge-blue-500 hover:underline">
          {t('apInvoiceDetail.backLink')}
        </Link>
      </div>

      {aiConfidence && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            aiConfidence === 'HIGH'
              ? 'border-green-300 bg-green-50 text-green-900'
              : aiConfidence === 'MEDIUM'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-gray-300 bg-gray-50 text-gray-700'
          }`}
        >
          <div className="font-semibold">
            ✓ AI-extracted from email PDF · confidence {aiConfidence.toLowerCase()}
          </div>
          {reviewerNote && <div className="mt-1 text-xs">{reviewerNote}</div>}
          <div className="mt-1 text-xs">
            Double-check the totals, dates, and line items before approving.
          </div>
        </div>
      )}

      <ApInvoiceStatusBar
        id={invoice.id}
        initialStatus={invoice.status}
        approvedAt={invoice.approvedAt}
        paidAt={invoice.paidAt}
      />
      <PostToGlButton apiBaseUrl={publicApiBaseUrl()} entity="ap-invoices" id={invoice.id} />
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ApInvoiceEditor initial={invoice} jobs={jobs} apiBaseUrl={publicApiBaseUrl()} />
      </div>

      {/* Email-attached PDF preview — visible only when the AP inbox
          poller saved one alongside the row. The endpoint streams the
          file from data/ap-inbox/. */}
      {/Attachment saved at:/i.test(invoice.notes ?? '') && (
        <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Original invoice (from email)
            </h2>
            <span className="flex flex-wrap items-center gap-3">
              <ApReextractButton
                invoiceId={invoice.id}
                apiBaseUrl={publicApiBaseUrl()}
              />
              <a
                href={`${publicApiBaseUrl()}/api/ap-invoices/${encodeURIComponent(invoice.id)}/attachment`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-700 hover:underline"
              >
                Open in new tab ↗
              </a>
            </span>
          </div>
          <iframe
            title="Vendor invoice PDF"
            src={`${publicApiBaseUrl()}/api/ap-invoices/${encodeURIComponent(invoice.id)}/attachment`}
            className="h-[800px] w-full rounded border border-gray-200"
          />
        </section>
      )}

      <AuditBinderPanel entityType="ApInvoice" entityId={invoice.id} />
    </main>
    </AppShell>
  );
}
