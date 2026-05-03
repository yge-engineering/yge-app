// /dispatch/new — assign a crew to a job for a day.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { DispatchEditor } from '../../../components/dispatch-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewDispatchPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/dispatch" className="text-sm text-yge-blue-500 hover:underline">
          {t('dispatchNew.backLink')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('dispatchNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('dispatchNew.subtitle')}</p>
      <div className="mt-6">
        <DispatchEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
