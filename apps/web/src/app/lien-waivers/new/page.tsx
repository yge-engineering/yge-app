// /lien-waivers/new — create a new lien waiver.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { LienWaiverEditor } from '../../../components/lien-waiver-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewLienWaiverPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/lien-waivers" className="text-sm text-yge-blue-500 hover:underline">
          {t('newLienWaiver.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newLienWaiver.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newLienWaiver.subtitle')}
      </p>
      <div className="mt-6">
        <LienWaiverEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
