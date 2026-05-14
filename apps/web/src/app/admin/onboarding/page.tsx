// /admin/onboarding — checklist for getting a new YGE instance live.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Step {
  num: number;
  title: string;
  href: string;
  blurb: string;
}

const STEPS: Step[] = [
  { num: 1, title: 'Upload Excel master', href: '/admin/excel-import', blurb: 'Run the 4 import sections (master tables, people/jobs, estimates, daily reports).' },
  { num: 2, title: 'Backfill customers', href: '/admin/excel-import', blurb: 'Hit POST /api/admin/excel-import/backfill-customers once to fix imported customer JSON.' },
  { num: 3, title: 'Connect Microsoft 365', href: '/admin/health', blurb: 'Grants Mail / Calendar / Tasks / Teams scopes for inbox triage, AP capture, etc.' },
  { num: 4, title: 'Verify data status', href: '/admin/data-status', blurb: 'All 12 master tables should show non-zero counts.' },
  { num: 5, title: 'Run a test bid', href: '/imported-estimates', blurb: 'Open any imported estimate, edit a line, push to OneDrive, pull back.' },
  { num: 6, title: 'Set bond capacity', href: '/risk-register', blurb: 'Enter current single + aggregate bond limits for tracking.' },
  { num: 7, title: 'Invite team', href: '/admin/portal-users', blurb: 'Add foremen, office staff, agency portal users.' },
];

export default function OnboardingPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Onboarding" subtitle="One-time setup checklist for getting YGE up and running." />
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li key={s.num} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline gap-3">
                <span className="rounded-full bg-yge-blue-600 px-3 py-1 text-xs font-bold text-white">{s.num}</span>
                <Link href={s.href} className="text-base font-semibold text-yge-blue-700 hover:underline">
                  {s.title}
                </Link>
              </div>
              <p className="ml-12 mt-1 text-sm text-gray-700">{s.blurb}</p>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
