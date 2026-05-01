// AppShell — the chrome around every signed-in page.
//
// Plain English: the YGE-branded header + the sidebar nav. Wraps
// children content. Hidden on /login since middleware redirects
// unauthenticated users away from anything that uses this shell.

import Link from 'next/link';

import { AccountChip } from './account-chip';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { MobileNav } from './mobile-nav';
import { Toaster } from './toast';

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
      { label: 'Calendar', href: '/calendar' },
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
      <KeyboardShortcuts />
      <Toaster />
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <MobileNav groups={NAV} />
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-700 text-xs font-bold text-white">
            YGE
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-gray-900">Young General Engineering</div>
            <div className="text-[11px] text-gray-500">Cottonwood, CA · CSLB 1145219 · DIR 2000018967</div>
          </div>
        </Link>
        <form action="/search" method="get" className="ml-auto hidden flex-1 max-w-md sm:block sm:mx-6">
          <div className="relative">
            <input
              name="q"
              type="search"
              placeholder="Search jobs, customers, vendors, employees…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 pr-10 text-sm focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500" aria-label="Press slash to focus">
              /
            </kbd>
          </div>
        </form>
        <div className="ml-auto sm:ml-0">
          <AccountChip />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white px-3 py-4 lg:block">
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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-xs text-gray-400">
        Young General Engineering, Inc · CSLB 1145219 · DIR 2000018967 · DOT 4528204 · Trouble? Call Ryan at 707-599-9921 ·{' '}
        <Link href="/changelog" className="hover:underline">What&apos;s new</Link>
        {' · '}
        <Link href="/terms" className="hover:underline">Terms</Link>
        {' · '}
        <Link href="/privacy" className="hover:underline">Privacy</Link>
      </footer>
    </div>
  );
}
