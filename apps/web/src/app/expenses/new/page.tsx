// /expenses/new — log a new expense receipt.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { ExpenseEditor } from '../../../components/expense-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewExpensePage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/expenses" className="text-sm text-yge-blue-500 hover:underline">
          {t('newExpensePg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newExpensePg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newExpensePg.subtitle')}
      </p>
      <div className="mt-6">
        <ExpenseEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
