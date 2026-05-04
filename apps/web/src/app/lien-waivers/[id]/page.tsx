// /lien-waivers/[id] — waiver detail / edit page.

import Link from 'next/link';

import { AppShell, AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import {
  coerceLocale,
  lienWaiverKindLabel,
  type LienWaiver,
} from '@yge/shared';
import { LienWaiverEditor } from '../../../components/lien-waiver-editor';
import { getTranslator } from '../../../lib/locale';
import { cookies } from 'next/headers';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchWaiver(id: string): Promise<LienWaiver | null> {
  const res = await fetch(`${apiBaseUrl()}/api/lien-waivers/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { waiver: LienWaiver }).waiver;
}

export default async function LienWaiverDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);
  const waiver = await fetchWaiver(params.id);
  if (!waiver) notFound();

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/lien-waivers" className="text-sm text-yge-blue-500 hover:underline">
          {t('newLienWaiver.back')}
        </Link>
        <Link
          href={`/lien-waivers/${waiver.id}/print`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          {t('lienWaiverPg.printForm')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {lienWaiverKindLabel(waiver.kind, locale)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {t('lienWaiverPg.subtitle', { jobName: waiver.jobName, date: waiver.throughDate })}
      </p>
      <p className="mt-1 text-xs text-gray-500">{t('photoPg.idLabel', { id: waiver.id })}</p>
      <div className="mt-6">
        <LienWaiverEditor mode="edit" waiver={waiver} />
      </div>

      <AuditBinderPanel entityType="LienWaiver" entityId={waiver.id} />
    </main>
    </AppShell>
  );
}
