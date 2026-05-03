// /bank-recs/[id] — bank rec detail / edit.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { BankRec } from '@yge/shared';
import { BankRecEditor } from '../../../components/bank-rec-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRec(id: string): Promise<BankRec | null> {
  const res = await fetch(`${apiBaseUrl()}/api/bank-recs/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { rec: BankRec }).rec;
}

export default async function BankRecDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const rec = await fetchRec(params.id);
  if (!rec) notFound();
  const t = getTranslator();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/bank-recs" className="text-sm text-yge-blue-500 hover:underline">
          {t('bankRecDetail.backLink')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {rec.bankAccountLabel}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{t('bankRecDetail.statementLine', { date: rec.statementDate })}</p>
      <p className="mt-1 text-xs text-gray-500">{t('bankRecDetail.idLine', { id: rec.id })}</p>
      <div className="mt-6">
        <BankRecEditor mode="edit" rec={rec} />
      </div>

      <AuditBinderPanel entityType="BankRec" entityId={rec.id} />
    </main>
  );
}
