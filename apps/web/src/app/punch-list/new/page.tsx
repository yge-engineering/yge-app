// /punch-list/new — create a new punch item.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PunchItemEditor } from '../../../components/punch-item-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewPunchItemPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/punch-list" className="text-sm text-yge-blue-500 hover:underline">
          {t('newPunchPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newPunchPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newPunchPg.subtitle')}
      </p>
      <div className="mt-6">
        <PunchItemEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
