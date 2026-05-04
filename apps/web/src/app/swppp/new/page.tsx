// /swppp/new — log a new SWPPP/BMP inspection.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { SwpppInspectionEditor } from '../../../components/swppp-inspection-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewSwpppInspectionPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/swppp" className="text-sm text-yge-blue-500 hover:underline">
          {t('newSwpppPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newSwpppPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newSwpppPg.subtitle')}
      </p>
      <div className="mt-6">
        <SwpppInspectionEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
