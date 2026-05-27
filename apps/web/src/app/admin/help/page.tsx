import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { heading: string; body: React.ReactNode }

const TOPICS: Topic[] = [
  {
    heading: 'How do I add a new customer / vendor / employee?',
    body: (
      <>
        Visit{' '}
        <Link href="/customers/new" className="text-yge-blue-700 hover:underline">/customers/new</Link>,
        {' '}<Link href="/vendors/new" className="text-yge-blue-700 hover:underline">/vendors/new</Link>,
        {' '}or <Link href="/employees/new" className="text-yge-blue-700 hover:underline">/employees/new</Link>.
        {' '}For bulk additions, use the{' '}
        <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">CSV imports hub</Link>.
      </>
    ),
  },
  {
    heading: 'Where can I see the data health checks?',
    body: (
      <>
        <Link href="/admin/data-quality-hub" className="text-yge-blue-700 hover:underline">/admin/data-quality-hub</Link>
        {' '}indexes every missing-* page. <Link href="/admin/data-health" className="text-yge-blue-700 hover:underline">/admin/data-health</Link>
        {' '}runs rule-based sanity checks against the entire dataset.
      </>
    ),
  },
  {
    heading: 'How do I onboard a new company (multi-tenant)?',
    body: (
      <>
        Use{' '}
        <Link href="/admin/onboarding" className="text-yge-blue-700 hover:underline">/admin/onboarding</Link>
        {' '}as a checklist of the master-data records to create. Multi-tenant is on the schema,
        but only YGE is enabled in the public preview.
      </>
    ),
  },
  {
    heading: 'Where are the audit logs?',
    body: (
      <>
        Every mutation is logged server-side. The full filterable viewer is on the roadmap (see{' '}
        <Link href="/admin/audit-recent" className="text-yge-blue-700 hover:underline">/admin/audit-recent</Link>).
        For now, ask Ryan to query the log directly.
      </>
    ),
  },
  {
    heading: 'How do I export the master tables?',
    body: (
      <>
        Visit{' '}
        <Link href="/admin/csv-exports" className="text-yge-blue-700 hover:underline">/admin/csv-exports</Link>
        {' '}for one-click CSV downloads of customers, vendors, materials, equipment, cost codes,
        labor rates, employees, jobs, imported estimates, bid results, and daily reports.
      </>
    ),
  },
  {
    heading: 'What is the "Profile expiries" warning panel?',
    body: (
      <>
        It surfaces every CSLB / DIR / insurance record on the{' '}
        <Link href="/master-profile" className="text-yge-blue-700 hover:underline">master profile</Link>
        {' '}that is either expired or due within 60 days. Red ≤30 days
        (or already expired), amber 31–60 days. Rendered on{' '}
        <Link href="/master-profile" className="text-yge-blue-700 hover:underline">/master-profile</Link>,{' '}
        <Link href="/dashboard/lite" className="text-yge-blue-700 hover:underline">/dashboard/lite</Link>,{' '}
        <Link href="/go-live" className="text-yge-blue-700 hover:underline">/go-live</Link>,{' '}
        on every bid-day cockpit, and on every saved draft. The panel
        self-hides when nothing is expiring.
      </>
    ),
  },
  {
    heading: 'Where is the diagnostic-triangle?',
    body: (
      <>
        Three pages, all cross-linked:{' '}
        <Link href="/api-status" className="text-yge-blue-700 hover:underline">/api-status</Link>
        {' '}(infrastructure probes),{' '}
        <Link href="/admin/version" className="text-yge-blue-700 hover:underline">/admin/version</Link>
        {' '}(web + API build SHA + AI prompt version),{' '}
        <Link href="/go-live" className="text-yge-blue-700 hover:underline">/go-live</Link>
        {' '}(tenant data readiness). When something looks weird, start at
        any of the three and click through to the others.
      </>
    ),
  },
  {
    heading: 'How does the YGE browser extension find values to fill?',
    body: (
      <>
        The MV3 extension at{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">extensions/yge-form-filler/</code>
        {' '}runs <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">classifyField()</code>
        {' '}on every form input it sees, matching the field's
        name/id/aria-label/label-text against a pattern dictionary
        in <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">field-patterns.js</code>.
        Pattern hits map to a profilePath. The path is resolved against
        the cached snapshot from <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">/api/extension/profile-snapshot</code>
        {' '}via <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">PROFILE_PATH_TO_SNAPSHOT_KEY</code>
        {' '}in the shared package. The popup shows{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">N fillable from master profile</code>
        {' '}— that's how many fields would write on Fill.
      </>
    ),
  },
  {
    heading: 'What is the "Extension snapshot" tile?',
    body: (
      <>
        Counts populated vs empty fields in the snapshot the
        extension auto-fills from. Renders on{' '}
        <Link href="/master-profile" className="text-yge-blue-700 hover:underline">/master-profile</Link>,{' '}
        <Link href="/dashboard/lite" className="text-yge-blue-700 hover:underline">/dashboard/lite</Link>,{' '}
        <Link href="/go-live" className="text-yge-blue-700 hover:underline">/go-live</Link>,
        on every saved draft, and on every bid-day cockpit.
        Tone: green = all populated · gray = 1-3 empty · amber =
        4+ empty. When amber, the tile lists which fields are
        empty — edit{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">packages/shared/src/company.ts</code>
        {' '}or the live master profile to fill them.
      </>
    ),
  },
];

export default function AdminHelpPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin help" subtitle="Common admin questions, in plain English." />
        <div className="space-y-3">
          {TOPICS.map((t, i) => (
            <details key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer font-semibold text-gray-900">{t.heading}</summary>
              <div className="mt-2 text-sm text-gray-700">{t.body}</div>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
