// AppShell — the chrome around every signed-in page.
//
// Plain English: the YGE-branded header + the sidebar nav. Wraps
// children content. Hidden on /login since middleware redirects
// unauthenticated users away from anything that uses this shell.

import Link from 'next/link';

import { AccountChip } from './account-chip';

interface NavLink {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const NAV: NavGroup[] = [
  {
    label: 'Daily',
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Dispatch', href: '/dispatch' },
      { label: 'Daily reports', href: '/daily-reports' },
      { label: 'Time cards', href: '/time-cards' },
    ],
  },
  {
    label: 'Project',
    links: [
      { label: 'Jobs', href: '/jobs' },
      { label: 'Estimates', href: '/estimates' },
      { label: 'Bid results', href: '/bid-results' },
      { label: 'Change orders', href: '/change-orders' },
      { label: 'RFIs', href: '/rfis' },
      { label: 'Submittals', href: '/submittals' },
      { label: 'Punch lists', href: '/punch-lists' },
    ],
  },
  {
    label: 'Money',
    links: [
      { label: 'AR invoices', href: '/ar-invoices' },
      { label: 'AR payments', href: '/ar-payments' },
      { label: 'AP invoices', href: '/ap-invoices' },
      { label: 'AP payments', href: '/ap-payments' },
      { label: 'Aging', href: '/aging' },
      { label: 'Cash forecast', href: '/cash-forecast' },
      { label: 'Bank recs', href: '/bank-recs' },
      { label: 'Balance sheet', href: '/balance-sheet' },
    ],
  },
  {
    label: 'Field',
    links: [
      { label: 'Crew', href: '/crew' },
      { label: 'Equipment', href: '/equipment' },
      { label: 'Mileage', href: '/mileage' },
      { label: 'Expenses', href: '/expenses' },
      { label: 'Photos', href: '/photos' },
    ],
  },
  {
    label: 'Compliance',
    links: [
      { label: 'Lien waivers', href: '/lien-waivers' },
      { label: 'Certified payrolls', href: '/certified-payrolls' },
      { label: 'DIR rates', href: '/dir-rates' },
      { label: 'Toolbox talks', href: '/toolbox-talks' },
      { label: 'Incidents', href: '/incidents' },
      { label: 'Weather', href: '/weather' },
      { label: 'SWPPP', href: '/swppp' },
    ],
  },
  {
    label: 'Records',
    links: [
      { label: 'Customers', href: '/customers' },
      { label: 'Vendors', href: '/vendors' },
      { label: 'Employees', href: '/employees' },
      { label: 'Documents', href: '/documents' },
    ],
  },
  {
    label: 'More',
    links: [
      { label: 'All modules', href: '/all-modules' },
      { label: 'Help', href: '/help' },
      { label: "What's new", href: '/changelog' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-xs font-bold text-white">
            YGE
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Young General Engineering</div>
            <div className="text-[11px] text-gray-500">Cottonwood, CA · CSLB 1145219 · DIR 2000018967</div>
          </div>
        </Link>
        <form action="/search" method="get" className="mx-6 max-w-md flex-1">
          <input
            name="q"
            type="search"
            placeholder="Search jobs, customers, vendors, employees…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
          />
        </form>
        <AccountChip />
      </header>
      <div className="flex flex-1">
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white px-3 py-4">
          <nav className="space-y-5">
            {NAV.map((group) => (
              <div key={group.label}>
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="block rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
