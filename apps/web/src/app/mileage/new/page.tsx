// /mileage/new — log a new mileage entry.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { MileageEntryEditor } from '../../../components/mileage-entry-editor';

export default function NewMileagePage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/mileage" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Mileage Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Log mileage</h1>
      <p className="mt-2 text-gray-700">
        Record a single trip — odometer or claimed miles, plus the IRS rate
        in effect on the trip date if reimbursable.
      </p>
      <div className="mt-6">
        <MileageEntryEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
