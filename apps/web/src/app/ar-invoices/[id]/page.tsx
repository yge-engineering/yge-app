// /ar-invoices/[id] — full editor with daily-report builder.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ArInvoice, Job } from '@yge/shared';
import { ArInvoiceEditor } from '@/components/ar-invoice-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchInvoice(id: string): Promise<ArInvoice | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/ar-invoices/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { invoice: ArInvoice }).invoice;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function ArInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [invoice, jobs] = await Promise.all([fetchInvoice(params.id), fetchJobs()]);
  if (!invoice) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/ar-invoices" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to invoices
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ArInvoiceEditor initial={invoice} jobs={jobs} apiBaseUrl={publicApiBaseUrl()} />
      </div>
    </main>
  );
}
