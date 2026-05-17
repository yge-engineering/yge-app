import { PrintAwardedByYearPanel } from './print-awarded-by-year-panel';

export const dynamic = 'force-dynamic';

export default function JobsAwardedByYearPrintPage() {
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Awarded jobs by year</h1>
        <p className="text-xs text-gray-600">Young General Engineering, Inc. · printed from YGE app.</p>
      </header>
      <PrintAwardedByYearPanel />
      <footer className="mt-6 text-[10px] text-gray-500">
        Includes jobs in status AWARDED / ACTIVE / CLOSED. Year from contractAwardDate (falling back to startDate).
      </footer>
    </main>
  );
}
