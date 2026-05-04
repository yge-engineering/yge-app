// /coa/new — add a new account.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { AccountEditor } from '../../../components/account-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewAccountPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/coa" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCoaPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newCoaPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newCoaPg.subtitle')}
      </p>
      <div className="mt-6">
        <AccountEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
