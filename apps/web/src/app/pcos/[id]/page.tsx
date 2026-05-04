// /pcos/[id] — PCO detail / edit page.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Pco } from '@yge/shared';
import { PcoEditor } from '../../../components/pco-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPco(id: string): Promise<Pco | null> {
  const res = await fetch(`${apiBaseUrl()}/api/pcos/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { pco: Pco }).pco;
}

export default async function PcoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const pco = await fetchPco(params.id);
  if (!pco) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/pcos" className="text-sm text-yge-blue-500 hover:underline">
          {t('newPcoPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{pco.title}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {pco.pcoNumber} · {pco.jobId}
      </p>
      <p className="mt-1 text-xs text-gray-500">{t('photoPg.idLabel', { id: pco.id })}</p>
      <div className="mt-6">
        <PcoEditor mode="edit" pco={pco} />
      </div>

      <AuditBinderPanel entityType="Pco" entityId={pco.id} />
    </main>
  );
}
