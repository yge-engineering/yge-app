// TODO 1701: surface /reports + /help + /customers/touchpoints in the sidebar nav.
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
import { usePathname } from 'next/navigation';
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
import { CommandPalette } from './command-palette';
import { ScrollToTop } from './scroll-to-top';
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


// Curated "quick action" entries injected into the ⌘-K palette
// alongside nav targets. These point at /<entity>/new pages so a
// single keyboard hit lands the user at a fresh form. Permission
// gates fall back to the sidebar's grouping — palette respects
// the same role grants.
interface QuickActionSpec {
  label: string;
  href: string;
  /** Short label shown in the "group" slot of the palette result. */
  group: string;
  requires?: Permission;
}

const QUICK_ACTIONS: QuickActionSpec[] = [
  { label: '+ New job',              href: '/jobs/new',              group: 'New' },
  { label: '+ New estimate (blank)', href: '/estimates',             group: 'New', requires: 'estimates:view' },
  { label: '+ New bid result',       href: '/bid-results/new',       group: 'New', requires: 'estimates:view' },
  { label: '+ New AR invoice',       href: '/ar-invoices/new',       group: 'New', requires: 'financials:view' },
  { label: '+ New AR payment',       href: '/ar-payments/new',       group: 'New', requires: 'financials:view' },
  { label: '+ New AP invoice',       href: '/ap-invoices/new',       group: 'New', requires: 'financials:view' },
  { label: '+ New AP payment',       href: '/ap-payments/new',       group: 'New', requires: 'financials:view' },
  { label: '+ New bank rec',         href: '/bank-recs/new',         group: 'New', requires: 'financials:view' },
  { label: '+ New expense',          href: '/expenses/new',          group: 'New' },
  { label: '+ New mileage entry',    href: '/mileage/new',           group: 'New' },
  { label: '+ New daily report',     href: '/daily-reports/new',     group: 'New' },
  { label: '+ New time card',        href: '/time-cards/new',        group: 'New' },
  { label: '+ New customer',         href: '/customers/new',         group: 'New' },
  { label: '+ New vendor',           href: '/vendors/new',           group: 'New' },
  { label: '+ New employee',         href: '/employees/new',         group: 'New' },
  { label: '+ New equipment',        href: '/equipment/new',         group: 'New' },
  { label: '+ New material',         href: '/materials/new',         group: 'New' },
  { label: '+ New tool',             href: '/tools/new',             group: 'New' },
  { label: '+ New photo',            href: '/photos/new',            group: 'New' },
  { label: '+ New RFI',              href: '/rfis/new',              group: 'New' },
  { label: '+ New submittal',        href: '/submittals/new',        group: 'New' },
  { label: '+ New change order',     href: '/change-orders/new',     group: 'New' },
  { label: '+ New PCO',              href: '/pcos/new',              group: 'New' },
  { label: '+ New lien waiver',      href: '/lien-waivers/new',      group: 'New' },
  { label: '+ New incident',         href: '/incidents/new',         group: 'New' },
  { label: '+ New SWPPP inspection', href: '/swppp/new',             group: 'New' },
  { label: '+ New toolbox talk',     href: '/toolbox-talks/new',     group: 'New' },
  { label: '+ New weather log',      href: '/weather/new',           group: 'New' },
  { label: '+ New dispatch',         href: '/dispatch/new',          group: 'New' },
  { label: '+ New cert. payroll',    href: '/certified-payrolls/new',group: 'New' },
  { label: '+ New certificate',      href: '/certificates/new',      group: 'New' },
  { label: '+ New document',         href: '/documents/new',         group: 'New' },
  { label: '+ New punch item',       href: '/punch-list/new',        group: 'New' },
  { label: '+ New COA account',      href: '/coa/new',               group: 'New', requires: 'financials:view' },
  { label: '+ New DIR rate',         href: '/dir-rates/new',         group: 'New' },
  { label: '+ New crew member',      href: '/crew/new',              group: 'New' },
];

const NAV_SPEC: NavGroupSpec[] = [
  {
    key: 'nav.group.daily',
    links: [
      { key: 'nav.dashboard', href: '/dashboard' },
      { key: 'nav.myToday', href: '/me/today' },
      { key: 'nav.calendar', href: '/calendar' },
      { key: 'nav.morningBriefing', href: '/morning-briefing' },
      { key: 'nav.inboxTriage', href: '/inbox-triage' },
      { key: 'nav.dispatch', href: '/dispatch' },
      { key: 'nav.dailyReports', href: '/daily-reports' },
      { key: 'nav.timeCards', href: '/time-cards' },
    ],
  },
  {
    key: 'nav.group.project',
    links: [
      { key: 'nav.jobs', href: '/jobs' },
      { key: 'nav.jobsBoard', href: '/jobs/board' },
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
      { key: 'nav.reports', href: '/reports', requires: 'financials:view' },
      { key: 'nav.arInvoices', href: '/ar-invoices', requires: 'financials:view' },
      { key: 'nav.arPayments', href: '/ar-payments', requires: 'financials:view' },
      { key: 'nav.apInvoices', href: '/ap-invoices', requires: 'financials:view' },
      { key: 'nav.apPayments', href: '/ap-payments', requires: 'financials:view' },
      { key: 'nav.aging', href: '/aging', requires: 'financials:view' },
      { key: 'nav.cashForecast', href: '/cash-forecast', requires: 'financials:view' },
      { key: 'nav.bankRecs', href: '/bank-recs', requires: 'financials:view' },
      { key: 'nav.cashPosition', href: '/cash-position', requires: 'financials:view' },
      { key: 'nav.tax1099Worksheet', href: '/1099-worksheet', requires: 'financials:view' },
      { key: 'nav.vendorW9Chase', href: '/vendor-w9-chase', requires: 'financials:edit' },
      { key: 'nav.coiChase', href: '/coi-chase', requires: 'financials:edit' },
      { key: 'nav.apCheckRun', href: '/ap-check-run', requires: 'financials:edit' },
      { key: 'nav.vendorSpend', href: '/vendor-spend', requires: 'financials:view' },
      { key: 'nav.customerConcentration', href: '/customer-concentration', requires: 'financials:view' },
      { key: 'nav.balanceSheet', href: '/balance-sheet', requires: 'financials:view' },
      { key: 'nav.trialBalance', href: '/trial-balance', requires: 'financials:view' },
      { key: 'nav.incomeStatement', href: '/income-statement', requires: 'financials:view' },
      { key: 'nav.cashFlow', href: '/cash-flow', requires: 'financials:view' },
      { key: 'nav.closePackage', href: '/close-package', requires: 'financials:view' },
      { key: 'nav.periodClose', href: '/period-close', requires: 'financials:edit' },
      { key: 'nav.yearEndClose', href: '/year-end-close', requires: 'financials:edit' },
      { key: 'nav.riskRegister', href: '/risk-register', requires: 'financials:view' },
      { key: 'nav.executiveSnapshot', href: '/executive-snapshot', requires: 'financials:view' },
      { key: 'nav.adminErrors', href: '/admin/errors', requires: 'audit:view' },
      { key: 'nav.adminGusto', href: '/admin/gusto', requires: 'audit:view' },
      { key: 'nav.adminHealth', href: '/admin/health', requires: 'audit:view' },
      { key: 'nav.adminDataHealth', href: '/admin/data-health', requires: 'audit:view' },
      { key: 'nav.excelImport', href: '/admin/excel-import', requires: 'audit:view' },
      { key: 'nav.portalOwnerPreview', href: '/portal/owner', requires: 'portal:owner' },
      { key: 'nav.portalSubPreview', href: '/portal/sub', requires: 'portal:sub' },
      { key: 'nav.portalBondPreview', href: '/portal/bond', requires: 'portal:bond' },
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
  const pathname = usePathname() ?? '';
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-yge-blue-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <KeyboardShortcuts />
      <Toaster />
      <ScrollToTop />
      <CommandPalette
        links={[
          ...NAV.flatMap((g) =>
            g.links.map((l) => ({ ...l, group: g.label })),
          ),
          ...QUICK_ACTIONS
            .filter((a) => !a.requires || (grants?.includes(a.requires) ?? true))
            .map((a) => ({ label: a.label, href: a.href, group: a.group })),
        ]}
      />
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 print:hidden">
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
          <Link
            href="/plans-to-estimate"
            className="hidden rounded-md bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-yge-blue-700 sm:inline-block"
            title="Start a new estimate"
          >
            + Estimate
          </Link>
          <PwaInstallButton />
          <LocaleSwitcher current={locale} />
          <AccountChip />
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white px-3 py-4 lg:block print:hidden">
          <nav className="space-y-5">
            {NAV.map((group) => (
              <div key={group.label}>
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.links.map((l) => {
                    const active = pathname === l.href || pathname.startsWith(l.href + '/');
                    return (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-100 ${active ? 'bg-yge-blue-50 font-semibold text-yge-blue-700' : 'text-gray-700 hover:text-gray-900'}`}
                        >
                          {l.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 print:px-0 print:py-0">{children}</main>
      </div>
      {/* Mobile FAB — only on small screens since header has the same CTA */}
      <Link
        href="/plans-to-estimate"
        data-fab-new-estimate="1"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center justify-center rounded-full bg-yge-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-yge-blue-700 sm:hidden print:hidden"
        title="Start a new estimate"
      >
        + Estimate
      </Link>
      <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-xs text-gray-400 print:hidden">
        {t('shell.footer')}{' '}
        <Link href="/changelog" className="hover:underline">{t('shell.footer.whatsNew')}</Link>
        {' · '}
        <Link href="/mobile" className="hover:underline">Mobile app</Link>
        {' · '}
        <Link href="/terms" className="hover:underline">{t('shell.footer.terms')}</Link>
        {' · '}
        <Link href="/privacy" className="hover:underline">{t('shell.footer.privacy')}</Link>
      </footer>
    </div>
  );
}
