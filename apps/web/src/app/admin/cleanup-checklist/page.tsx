import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Step { title: string; description: string; href: string }

const STEPS: Step[] = [
  { title: 'Customers missing email', description: 'Chase the ones without an email.', href: '/customers/missing-email' },
  { title: 'Vendors missing email', description: 'Same for vendors.', href: '/vendors/missing-email' },
  { title: 'Jobs missing owner agency', description: 'Pipeline reports rely on agency. Fill these in first.', href: '/jobs/missing-owner-agency' },
  { title: 'Jobs missing rate type', description: 'Without rate type, costing assumptions cannot run.', href: '/jobs/missing-rate-type' },
  { title: 'Employees missing classification', description: 'Classification gates payroll and PWC-100 reports.', href: '/employees/missing-classification' },
  { title: 'Customers / vendors with no contact info at all', description: 'Records with neither email nor phone.', href: '/customers/no-contact-info' },
  { title: 'Vendor COIs about to expire', description: 'Renew certificates before they lapse.', href: '/vendors/coi-aging' },
  { title: 'Customers on hold', description: 'Confirm none of these should be released.', href: '/customers/on-hold' },
];

export default function CleanupChecklistPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cleanup checklist" subtitle="Eight short tasks to keep the master data healthy." />
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{i + 1}. {s.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{s.description}</p>
              <Link href={s.href} className="mt-2 inline-block text-xs text-yge-blue-700 hover:underline">{s.href} →</Link>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
