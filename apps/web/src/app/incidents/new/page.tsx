// /incidents/new — log a new OSHA 300 incident.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { IncidentEditor } from '../../../components/incident-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewIncidentPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/incidents" className="text-sm text-yge-blue-500 hover:underline">
          {t('newIncidentPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newIncidentPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newIncidentPg.subtitle')}
      </p>
      <div className="mt-6">
        <IncidentEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
