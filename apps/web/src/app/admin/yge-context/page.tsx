import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function YgeContextPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="YGE context" subtitle="One-screen orientation for anyone new to the app." />

        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Company</h2>
            <p>Young General Engineering, Inc. — heavy-civil contractor in Cottonwood, CA.</p>
            <ul className="ml-6 list-disc">
              <li>President: Brook L. Young</li>
              <li>Vice President: Ryan D. Young</li>
              <li>License: CSLB 1145219 · DIR 2000018967 · DOT 4528204</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Who uses the app</h2>
            <ul className="ml-6 list-disc">
              <li>Ryan + Brook — own everything they touch</li>
              <li>Office staff — bookkeeping, AP/AR, payroll</li>
              <li>Foremen — daily reports, timecards, photos</li>
              <li>Field crew — clock in/out, PTO, training certs, pay portal</li>
              <li>External portal users — agency owners, subs, bond agents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Core data shapes</h2>
            <ul className="ml-6 list-disc">
              <li><b>Job</b> — every project YGE bids or works. Status moves through PROSPECT → PURSUING → BID_SUBMITTED → AWARDED → ACTIVE → CLOSED, with LOST / NO_BID / ARCHIVED as terminal off-ramps.</li>
              <li><b>Bid result</b> — agency bid tabulation. Outcome is one of WON_BY_YGE / WON_BY_OTHER / NO_AWARD / TBD.</li>
              <li><b>Imported estimate</b> — workbook of estimate lines (qty, unit cost, cost code) tied to a job.</li>
              <li><b>Master data</b> — customers, vendors, employees, materials, equipment rates, labor rates, cost codes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Useful starting points</h2>
            <ul className="ml-6 list-disc">
              <li><Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link> — command center</li>
              <li><Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link> — VP overview</li>
              <li><Link href="/admin/grand-index" className="text-yge-blue-700 hover:underline">/admin/grand-index</Link> — full catalog</li>
              <li><Link href="/help/glossary" className="text-yge-blue-700 hover:underline">/help/glossary</Link> — vocabulary</li>
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
