// 1801 — reports landing at 1800+ bundles.
// /reports — landing page for all analyses + financial reports.

import Link from 'next/link';

import {
  AppShell,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';

interface ReportLink {
  href: string;
  label: string;
  blurb: string;
}

interface ReportGroup {
  title: string;
  caption: string;
  links: ReportLink[];
}

const GROUPS: ReportGroup[] = [
  {
    title: 'Search',
    caption: 'Find anything fast.',
    links: [
      {
        href: '/imported-estimates/search',
        label: 'Search bids',
        blurb: 'Full-text search across imported estimates (project, client, notes, line descriptions).',
      },
      {
        href: '/customers/search',
        label: 'Search customers',
        blurb: 'By name, contact, or email.',
      },
      {
        href: '/vendors/search',
        label: 'Search vendors',
        blurb: 'By name, trade specialty, or email.',
      },
      {
        href: '/cost-codes/search',
        label: 'Search cost codes',
        blurb: 'By code prefix, name, or category.',
      },
    ],
  },
  {
    title: 'Touchpoints & alerts',
    caption: 'Where to look first to find risk or untapped opportunity.',
    links: [
      {
        href: '/customers/touchpoints',
        label: 'Customer dormancy',
        blurb: 'Customers we haven\'t engaged with in months, sorted dormant-first.',
      },
      {
        href: '/customers/email-list',
        label: 'Customer email list',
        blurb: 'All contact emails + BCC string for newsletters/holiday cards.',
      },
      {
        href: '/vendors/email-list',
        label: 'Vendor email list',
        blurb: 'Sub/supplier emails with kind filter + BCC string.',
      },
      {
        href: '/daily-reports/imported',
        label: 'Imported daily reports',
        blurb: 'Every Excel-imported daily report across all jobs.',
      },
      {
        href: '/customers/concentration',
        label: 'Customer concentration + HHI',
        blurb: 'Revenue share per customer + Herfindahl-Hirschman index for bonding underwriters.',
      },
      {
        href: '/cost-codes/trends',
        label: 'Cost code price trends',
        blurb: 'Codes whose unit cost climbed/fell most vs prior bids.',
      },
      {
        href: '/admin/data-status',
        label: 'Data health',
        blurb: 'Record counts per entity — quickly spot wiped master tables.',
      },
      {
        href: '/vendors',
        label: 'Vendor / sub COI aging',
        blurb: 'Subs with expired or expiring certificates of insurance.',
      },
    ],
  },
  {
    title: 'Estimating & pipeline',
    caption: 'Pursue, price, win — Excel-backed bids and analytics.',
    links: [
      {
        href: '/bids',
        label: 'Bids hub',
        blurb: 'Landing page for everything bid-related (calendar, pipeline, Kanban, results).',
      },
      {
        href: '/bids/calendar',
        label: 'Bid calendar',
        blurb: 'Every pursuing job with a bid due date, grouped by week. Overdue bids float to the top.',
      },
      {
        href: '/jobs/board',
        label: 'Jobs Kanban',
        blurb: 'Pursuit pipeline as a card board (PROSPECT → PURSUING → SUBMITTED → AWARDED).',
      },
      {
        href: '/jobs/by-year',
        label: 'Jobs by year',
        blurb: 'Total / awarded / lost / hit-rate per year.',
      },
      {
        href: '/jobs/awarded-revenue',
        label: 'Awarded revenue YoY',
        blurb: 'Trailing revenue view by award year — bonding-friendly.',
      },
      {
        href: '/imported-estimates',
        label: 'Imported estimates',
        blurb: 'Every estimate imported from Excel, with audit-warning chips and bid-status badges.',
      },
      {
        href: '/imported-estimates/pinned',
        label: '📌 Pinned bids',
        blurb: 'Only the bids you are actively working on.',
      },
      {
        href: '/imported-estimates/submitted',
        label: 'Submitted bids',
        blurb: 'Bids marked submitted (timestamps captured).',
      },
      {
        href: '/imported-estimates/compare',
        label: 'Compare two bids',
        blurb: 'Side-by-side cost-code diff between any two imported estimates.',
      },
      {
        href: '/cost-codes',
        label: 'Cost code master',
        blurb: 'Every cost code + top-10 spend across all imported estimates.',
      },
      {
        href: '/equipment-rates/usage',
        label: 'Equipment usage',
        blurb: 'Bid vs Actual hours and $ per piece of equipment across every job.',
      },
      {
        href: '/employees/utilization',
        label: 'Labor utilization',
        blurb: 'Hours logged per employee per week, from daily report LAB-* lines.',
      },
      {
        href: '/bid-results',
        label: 'Bid results',
        blurb: 'Every bid we have outcome data on, plus lifetime win rate.',
      },
      {
        href: '/bid-results/by-agency',
        label: 'Win rate by agency',
        blurb: 'How often we win at each owner agency, color-coded.',
      },
      {
        href: '/bid-results/by-year',
        label: 'Bid history by year',
        blurb: 'YoY bid count, win rate, won \$ — for trend talks with bank/bonding.',
      },
      {
        href: '/vendors/scorecard',
        label: 'Subcontractor scorecard',
        blurb: 'Per-sub paid total, open balance, avg days-to-pay, jobs delivered.',
      },
    ],
  },
  {
    title: 'Daily decisions',
    caption: 'Pull up first thing in the morning.',
    links: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        blurb: 'Today’s tiles — close progress, risk register, AR aging, vendor spend.',
      },
      {
        href: '/morning-briefing',
        label: 'Morning briefing',
        blurb: 'Yard-meet brief — headlines + reports + dispatches + safety + AR.',
      },
      {
        href: '/inbox-triage',
        label: 'Inbox triage',
        blurb: 'AI classifies your last 25 Outlook emails into 10 categories. One-click Draft AP on vendor bills.',
      },
      {
        href: '/risk-register',
        label: 'Risk register',
        blurb: 'One page rolling up concentration / tax / COI / AR / cash.',
      },
      {
        href: '/executive-snapshot',
        label: 'Executive snapshot',
        blurb: 'One-page board / bank / bonding summary — cash + revenue + concentration.',
      },
      {
        href: '/cash-position',
        label: 'Cash position',
        blurb: 'Latest reconciled balance per bank account + total cash on hand.',
      },
      {
        href: '/aging',
        label: 'AR + AP aging',
        blurb: 'Open invoices bucketed 0–30 / 31–60 / 61–90 / 90+.',
      },
      {
        href: '/ap-check-run',
        label: 'AP check run',
        blurb: 'Approved + unpaid AP grouped by vendor, sorted by urgency.',
      },
    ],
  },
  {
    title: 'Money — income, spending, concentration',
    caption: 'AR + AP analytics, vendor + customer concentration.',
    links: [
      {
        href: '/vendor-spend',
        label: 'Vendor spend',
        blurb: 'Where the money went, top-5 concentration warning.',
      },
      {
        href: '/customer-concentration',
        label: 'Customer concentration',
        blurb: 'Revenue by customer + HHI for bonding underwriters.',
      },
      {
        href: '/balance-sheet',
        label: 'Balance sheet',
        blurb: 'Assets, liabilities, equity at a point in time.',
      },
      {
        href: '/income-statement',
        label: 'Income statement',
        blurb: 'Revenue − expenses for a date range. Y/Y comparison ready.',
      },
      {
        href: '/cash-flow',
        label: 'Cash flow',
        blurb: 'Indirect-method cash flow statement.',
      },
      {
        href: '/trial-balance',
        label: 'Trial balance',
        blurb: 'Every account, every debit and credit, balanced.',
      },
      {
        href: '/cash-forecast',
        label: '13-week cash forecast',
        blurb: 'Projected inflows vs outflows by week.',
      },
    ],
  },
  {
    title: 'Close cycles + tax',
    caption: 'Monthly + year-end close playbooks, 1099 prep.',
    links: [
      {
        href: '/close-checklist',
        label: 'Close checklist',
        blurb: 'All the blockers that need to pass before a month closes.',
      },
      {
        href: '/period-close',
        label: 'Monthly close wizard',
        blurb: '8-step sequenced checklist for month-end.',
      },
      {
        href: '/year-end-close',
        label: 'Year-end close',
        blurb: '10-step year-end wizard for the CPA + bank package.',
      },
      {
        href: '/close-package',
        label: 'Close package',
        blurb: 'Full close-out PDF set ready to send the CPA.',
      },
      {
        href: '/1099-worksheet',
        label: '1099-NEC worksheet',
        blurb: 'Year-end 1099 prep with W-9 / TIN blocker flags.',
      },
      {
        href: '/vendor-w9-chase',
        label: 'W-9 chase list',
        blurb: 'Vendors over $600 missing a current W-9. Mailto: chase template per row.',
      },
    ],
  },
  {
    title: 'Compliance + records',
    caption: 'Lien waivers, CPRs, submittals, RFIs, COIs.',
    links: [
      {
        href: '/lien-waivers',
        label: 'Lien waivers',
        blurb: 'Conditional + unconditional, preliminary + progress + final.',
      },
      {
        href: '/certified-payrolls',
        label: 'Certified payrolls',
        blurb: 'CPRs for prevailing-wage jobs, weekly.',
      },
      {
        href: '/submittals',
        label: 'Submittals',
        blurb: 'Spec submittals tracked by status + revision.',
      },
      {
        href: '/rfis',
        label: 'RFIs',
        blurb: 'Requests for information across all jobs.',
      },
      {
        href: '/change-orders',
        label: 'Change orders + PCOs',
        blurb: 'Pending vs executed change orders.',
      },
      {
        href: '/vendors',
        label: 'Vendor / sub master',
        blurb: 'COI, W-9, prequal status. COI aging is built in.',
      },
      {
        href: '/coi-chase',
        label: 'COI chase list',
        blurb: 'Subs with expired or expiring COIs. Mailto: COI request per row.',
      },
    ],
  },
  {
    title: 'Admin / health',
    caption: 'System integrity + integration status.',
    links: [
      {
        href: '/help',
        label: 'Help & keyboard shortcuts',
        blurb: 'Where things live + how to move around fast.',
      },
      {
        href: '/admin/onboarding',
        label: 'Onboarding checklist',
        blurb: '7-step new-instance setup walkthrough.',
      },
      {
        href: '/admin/api-tour',
        label: 'API tour',
        blurb: 'All 50+ endpoints shipped this session, grouped by domain.',
      },
      {
        href: '/admin/health',
        label: 'System health',
        blurb: 'Anthropic + Storage + Graph + Gusto + Postgres + errors.',
      },
      {
        href: '/admin/data-status',
        label: 'Data health',
        blurb: 'Record counts per entity — red flags wiped master tables.',
      },
      {
        href: '/admin/errors',
        label: 'Server errors',
        blurb: 'Last 24h of uncaught errors with stack traces.',
      },
      {
        href: '/admin/gusto',
        label: 'Gusto integration',
        blurb: 'Payroll sync status + last-run log.',
      },
    ],
  },
];

export default function ReportsLandingPage() {
  requirePermission('financials:view');

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Reports"
          subtitle="Every analysis and financial report in the app, organized by use case."
        />

        <div className="space-y-6">
          {GROUPS.map((g) => (
            <section
              key={g.title}
              className="rounded-md border border-gray-200 bg-white p-4"
            >
              <header className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  {g.title}
                </h2>
                <p className="text-xs text-gray-600">{g.caption}</p>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {g.links.map((r) => (
                  <li
                    key={r.href}
                    className="rounded border border-gray-100 bg-gray-50 p-3"
                  >
                    <Link
                      href={r.href}
                      className="text-sm font-semibold text-yge-blue-700 hover:underline"
                    >
                      {r.label}
                    </Link>
                    <p className="mt-1 text-xs text-gray-600">{r.blurb}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
