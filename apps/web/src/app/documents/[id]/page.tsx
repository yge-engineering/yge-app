// /documents/[id] — edit a document.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Document, Job } from '@yge/shared';
import { DocumentEditor } from '@/components/document-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchDocument(id: string): Promise<Document | null> {
  const res = await fetch(`${apiBaseUrl()}/api/documents/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { document: Document }).document;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const [doc, jobs] = await Promise.all([fetchDocument(params.id), fetchJobs()]);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/documents" className="text-sm text-yge-blue-500 hover:underline">
          {t('newDocument.back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <DocumentEditor initial={doc} jobs={jobs} apiBaseUrl={publicApiBaseUrl()} />
      </div>

      <AuditBinderPanel entityType="Document" entityId={doc.id} />
    </main>
  );
}
