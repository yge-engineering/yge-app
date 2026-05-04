// /pcos/new — open a new potential change order.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PcoEditor } from '../../../components/pco-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewPcoPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/pcos" className="text-sm text-yge-blue-500 hover:underline">
          {t('newPcoPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newPcoPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newPcoPg.subtitle')}
      </p>
      <div className="mt-6">
        <PcoEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
