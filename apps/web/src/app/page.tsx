import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-yge-blue-500">YGE App</h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-gray-500">
          Young General Engineering, Inc.
        </p>
        <p className="mt-6 text-gray-700">
          Estimating, job management, and bookkeeping for heavy civil work. Replaces Excel + QuickBooks
          Online with a single connected system.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700"
          >
            Open Dashboard
          </Link>
          <Link
            href="/plans-to-estimate"
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700"
          >
            Plans-to-Estimate (AI)
          </Link>
          <Link
            href="/drafts"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Saved Drafts
          </Link>
          <Link
            href="/estimates"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Priced Estimates
          </Link>
          <Link
            href="/jobs"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            View Jobs
          </Link>
          <Link
            href="/crew"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Crew Roster
          </Link>
          <Link
            href="/tools"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Power Tools
          </Link>
          <Link
            href="/equipment"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Equipment
          </Link>
          <Link
            href="/daily-reports"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Daily Reports
          </Link>
          <Link
            href="/brand"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Brand kit
          </Link>
          <Link
            href="/bid-results"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Bid Results
          </Link>
          <Link
            href="/certificates"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Certificates
          </Link>
          <Link
            href="/documents"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Documents
          </Link>
          <Link
            href="/ap-invoices"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            AP Invoices
          </Link>
          <Link
            href="/rfis"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            RFIs
          </Link>
          <Link
            href="/materials"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Materials
          </Link>
          <Link
            href="/ar-invoices"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Customer Invoices
          </Link>
          <Link
            href="/submittals"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Submittals
          </Link>
          <Link
            href="/change-orders"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Change Orders
          </Link>
          <Link
            href="/time-cards"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Time Cards
          </Link>
          <Link
            href="/certified-payrolls"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Certified Payroll
          </Link>
          <Link
            href="/vendors"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Vendors
          </Link>
          <Link
            href="/ar-payments"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Customer Payments
          </Link>
          <Link
            href="/lien-waivers"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Lien Waivers
          </Link>
          <Link
            href="/punch-list"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Punch List
          </Link>
          <Link
            href="/toolbox-talks"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Toolbox Talks
          </Link>
          <Link
            href="/incidents"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            OSHA 300 Log
          </Link>
          <Link
            href="/weather"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Weather Log
          </Link>
          <Link
            href="/retention"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Retention
          </Link>
          <Link
            href="/pcos"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            PCOs
          </Link>
          <Link
            href="/swppp"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            SWPPP Inspections
          </Link>
          <Link
            href="/dispatch"
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700"
          >
            Dispatch Board
          </Link>
        </div>
        <p className="mt-12 text-xs text-gray-400">
          Phase 1 MVP — under active development. See README.md and CLAUDE.md.
        </p>
      </div>
    </main>
  );
}
