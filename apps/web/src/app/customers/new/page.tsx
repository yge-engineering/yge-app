// /customers/new — create a new customer.

import { CustomerCsvImportForm } from '../../../components/customer-csv-import-form';
import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { CustomerEditor } from '../../../components/customer-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewCustomerPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-yge-blue-500 hover:underline">
          {t('customerDetail.backLink')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('customerNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('customerNew.subtitle')}</p>
      <div className="mt-6">
        <CustomerEditor mode="create" />
      </div>
          <section className="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Bulk import (CSV)</h2>
        <p className="mb-3 text-xs text-gray-600">
          Upload a CSV with columns <code>legalName</code> and{' '}
          <code>kind</code> (and optionally dbaName / contactName / email
          / phone / billingAddressLine / city / state / zip /
          paymentTerms). Existing customers are matched by legalName
          (case-insensitive) and updated; new ones are created.
        </p>
        <CustomerCsvImportForm />
      </section>
      </main>
    </AppShell>
  );
}
