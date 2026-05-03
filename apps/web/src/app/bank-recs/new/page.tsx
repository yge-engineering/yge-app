// /bank-recs/new — start a new bank reconciliation.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { BankRecEditor } from '../../../components/bank-rec-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewBankRecPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/bank-recs" className="text-sm text-yge-blue-500 hover:underline">
          {t('bankRecDetail.backLink')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('bankRecNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('bankRecNew.subtitle')}</p>
      <div className="mt-6">
        <BankRecEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
