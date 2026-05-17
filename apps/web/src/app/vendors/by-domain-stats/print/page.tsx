import { PrintDomainStatsPanel } from './print-domain-stats-panel';

export const dynamic = 'force-dynamic';

export default function VendorsByDomainStatsPrintPage() {
  return (
    <main className="mx-auto max-w-2xl bg-white p-8 print:p-0">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Vendor domain stats</h1>
        <p className="text-xs text-gray-600">Young General Engineering, Inc. · printed from YGE app.</p>
      </header>
      <PrintDomainStatsPanel />
      <footer className="mt-6 text-[10px] text-gray-500">
        Snapshot computed live in the browser at print time.
      </footer>
    </main>
  );
}
