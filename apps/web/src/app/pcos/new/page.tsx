// /pcos/new — open a new potential change order.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PcoEditor } from '../../../components/pco-editor';

export default function NewPcoPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/pcos" className="text-sm text-yge-blue-500 hover:underline">
          &larr; PCOs
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New PCO</h1>
      <p className="mt-2 text-gray-700">
        Capture a potential change order before it becomes a formal CO.
      </p>
      <div className="mt-6">
        <PcoEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
