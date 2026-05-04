'use client';

// AppShell — the chrome around every signed-in page.
//
// Plain English: the YGE-branded header + the sidebar nav. Wraps
// children content. Hidden on /login since middleware redirects
// unauthenticated users away from anything that uses this shell.
//
// Implementation note: AppShell is a client component so it can be
// rendered from both server pages AND `'use client'` form pages
// without dragging server-only `next/headers` into the client bundle.
// Translations come from `useTranslator()` / `useLocale()` (which read
// the locale cookie via `document.cookie`). The httpOnly session
// cookie used by AccountChip is read server-side via `/api/me`.

import Link from 'next/link';

import { AccountChip } from './account-chip';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { Toaster } from './toast';
import { useLocale, useTranslator } from '../lib/use-translator';

interface NavLink {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

interface NavLinkSpec {
  key: string;
  href: string;
}

interface NavGroupSpec {
  key: string;
  links: NavLinkSpec[];
}

const NAV_SPEC: NavGroupSpec[] = [
  {
    key: 'nav.group.daily',
    links: [
      { key: 'nav.dashboard', href: '/dashboard' },
      { key: 'nav.myToday', href: '/me/today' },
      { key: 'nav.calendar', href: '/calendar' },
      { key: 'nav.dispatch', href: '/dispatch' },
      { key: 'nav.dailyReports', href: '/daily-reports' },
      { key: 'nav.timeCards', href: '/time-cards' },
    ],
  },
  {
    key: 'nav.group.project',
    links: [
      { key: 'nav.jobs', href: '/jobs' },
      { key: 'nav.estimates', href: '/estimates' },
      { key: 'nav.bidResults', href: '/bid-results' },
      { key: 'nav.changeOrders', href: '/change-orders' },
      { key: 'nav.rfis', href: '/rfis' },
      { key: 'nav.submittals', href: '/submittals' },
      { key: 'nav.punchLists', href: '/punch-lists' },
    ],
  },
  {
    key: 'nav.group.money',
    links: [
      { key: 'nav.arInvoices', href: '/ar-invoices' },
      { key: 'nav.arPayments', href: '/ar-payments' },
      { key: 'nav.apInvoices', href: '/ap-invoices' },
      { key: 'nav.apPayments', href: '/ap-payments' },
      { key: 'nav.aging', href: '/aging' },
      { key: 'nav.cashForecast', href: '/cash-forecast' },
      { key: 'nav.bankRecs', href: '/bank-recs' },
      { key: 'nav.balanceSheet', href: '/balance-sheet' },
    ],
  },
  {
    key: 'nav.group.field',
    links: [
      { key: 'nav.crew', href: '/crew' },
      { key: 'nav.equipment', href: '/equipment' },
      { key: 'nav.mileage', href: '/mileage' },
      { key: 'nav.expenses', href: '/expenses' },
      { key: 'nav.photos', href: '/photos' },
    ],
  },
  {
    key: 'nav.group.compliance',
    links: [
      { key: 'nav.lienWaivers', href: '/lien-waivers' },
      { key: 'nav.certifiedPayrolls', href: '/certified-payrolls' },
      { key: 'nav.dirRates', href: '/dir-rates' },
      { key: 'nav.toolboxTalks', href: '/toolbox-talks' },
      { key: 'nav.incidents', href: '/incidents' },
      { key: 'nav.weather', href: '/weather' },
      { key: 'nav.swppp', href: '/swppp' },
    ],
  },
  {
    key: 'nav.group.records',
    links: [
      { key: 'nav.customers', href: '/customers' },
      { key: 'nav.vendors', href: '/vendors' },
      { key: 'nav.employees', href: '/employees' },
      { key: 'nav.team', href: '/team' },
      { key: 'nav.documents', href: '/documents' },
    ],
  },
  {
    key: 'nav.group.more',
    links: [
      { key: 'nav.allModules', href: '/all-modules' },
      { key: 'nav.printViews', href: '/print' },
      { key: 'nav.settings', href: '/settings' },
      { key: 'nav.help', href: '/help' },
      { key: 'nav.changelog', href: '/changelog' },
      { key: 'nav.feedback', href: '/feedback' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslator();
  const locale = useLocale();
  const NAV: NavGroup[] = NAV_SPEC.map((g) => ({
    label: t(g.key),
    links: g.links.map((l) => ({ label: t(l.key), href: l.href })),
  }));
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
            <div className="text-sm font-semibold text-gray-900">{t('shell.companyName')}</div>
            <div className="text-[11px] text-gray-500">{t('shell.companyTagline')}</div>
          </div>
        </Link>
        <form action="/search" method="get" className="ml-auto hidden flex-1 max-w-md sm:block sm:mx-6">
          <div className="relative">
            <input
              name="q"
              type="search"
              placeholder={t('shell.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 pr-10 text-sm focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500" aria-label={t('shell.searchKeyAria')}>
              /
            </kbd>
          </div>
        </form>
        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          <LocaleSwitcher current={locale} />
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
        {t('shell.footer')}{' '}
        <Link href="/changelog" className="hover:underline">{t('shell.footer.whatsNew')}</Link>
        {' · '}
        <Link href="/terms" className="hover:underline">{t('shell.footer.terms')}</Link>
        {' · '}
        <Link href="/privacy" className="hover:underline">{t('shell.footer.privacy')}</Link>
      </footer>
    </div>
  );
}
