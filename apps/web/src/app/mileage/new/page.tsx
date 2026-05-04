// /mileage/new — log a new mileage entry.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { MileageEntryEditor } from '../../../components/mileage-entry-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewMileagePage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/mileage" className="text-sm text-yge-blue-500 hover:underline">
          {t('newMileagePg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newMileagePg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newMileagePg.subtitle')}
      </p>
      <div className="mt-6">
        <MileageEntryEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
