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
import { useEffect, useState } from 'react';
import {
  ROLE_PERMISSIONS,
  type Permission,
  type PortalRole,
} from '@yge/shared';

import { AccountChip } from './account-chip';
import { PwaInstallButton } from './pwa-install-button';
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
  /** Optional permission required to see this link in the sidebar.
   *  Omitted = visible to all signed-in users. */
  requires?: Permission;
}

interface NavGroupSpec {
  key: string;
  links: NavLinkSpec[];
  /** Optional group-level permission. If set, the entire group hides
   *  unless the user has it (or any of its children's requires). */
  requires?: Permission;
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
      { key: 'nav.estimates', href: '/estimates', requires: 'estimates:view' },
      { key: 'nav.bidResults', href: '/bid-results', requires: 'estimates:view' },
      { key: 'nav.changeOrders', href: '/change-orders' },
      { key: 'nav.rfis', href: '/rfis' },
      { key: 'nav.submittals', href: '/submittals' },
      { key: 'nav.punchLists', href: '/punch-lists' },
    ],
  },
  {
    key: 'nav.group.money',
    links: [
      { key: 'nav.arInvoices', href: '/ar-invoices', requires: 'financials:view' },
      { key: 'nav.arPayments', href: '/ar-payments', requires: 'financials:view' },
      { key: 'nav.apInvoices', href: '/ap-invoices', requires: 'financials:view' },
      { key: 'nav.apPayments', href: '/ap-payments', requires: 'financials:view' },
      { key: 'nav.aging', href: '/aging', requires: 'financials:view' },
      { key: 'nav.cashForecast', href: '/cash-forecast', requires: 'financials:view' },
      { key: 'nav.bankRecs', href: '/bank-recs', requires: 'financials:view' },
      { key: 'nav.balanceSheet', href: '/balance-sheet', requires: 'financials:view' },
    ],
  },
  {
    key: 'nav.group.field',
    links: [
      { key: 'nav.crew', href: '/crew' },
      { key: 'nav.equipment', href: '/equipment' },
      { key: 'nav.equipmentRates', href: '/equipment-rates' },
      { key: 'nav.costCodes', href: '/cost-codes' },
      { key: 'nav.importedEstimates', href: '/imported-estimates' },
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
      { key: 'nav.files', href: '/files' },
      { key: 'nav.documents', href: '/documents' },
    ],
  },
  {
    key: 'nav.group.more',
    links: [
      { key: 'nav.allModules', href: '/all-modules' },
      { key: 'nav.masterProfile', href: '/master-profile', requires: 'masterProfile:view' },
      { key: 'nav.audit', href: '/audit', requires: 'audit:view' },
      { key: 'nav.portalUsers', href: '/admin/portal-users', requires: 'portalUsers:manage' },
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
  // Fetch the signed-in user once on mount so we can filter the
  // sidebar by their role's permissions. Until the fetch resolves
  // we render every link (assume admin) so first paint isn't empty;
  // once we know the role, links the user can't access disappear.
  const [role, setRole] = useState<PortalRole | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const r = (j as { user?: { role?: PortalRole } } | null)?.user?.role;
        if (r) setRole(r);
      })
      .catch(() => {
        // Non-fatal — falls back to "show everything" until the next reload.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const grants = role ? (ROLE_PERMISSIONS[role] ?? []) : null;
  function linkVisible(spec: NavLinkSpec): boolean {
    if (!spec.requires) return true;
    if (!grants) return true; // pre-fetch — show everything
    return grants.includes(spec.requires);
  }
  const NAV: NavGroup[] = NAV_SPEC.map((g) => ({
    label: t(g.key),
    links: g.links
      .filter(linkVisible)
      .map((l) => ({ label: t(l.key), href: l.href })),
  })).filter((g) => g.links.length > 0);
  return (
    <div className="min-h-screen flex flex-col">
      <KeyboardShortcuts />
      <Toaster />
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <MobileNav groups={NAV} />
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* New logo provided May 2026: Y in red over GE, with the
           *  YOUNG / GENERAL ENGINEERING wordmark below. */}
          <img
            src="/yge-logo.jpg"
            alt="Young General Engineering"
            className="h-12 w-auto"
          />
          <div className="hidden sm:block">
            <div className="text-[12px] font-semibold leading-tight text-red-800">
              Cottonwood, CA
            </div>
            <div className="text-[10px] leading-tight text-red-800">
              CSLB 1145219 SB/DVBE
            </div>
            <div className="text-[10px] leading-tight text-red-800">
              DIR 2000018967
            </div>
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
          <PwaInstallButton />
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
