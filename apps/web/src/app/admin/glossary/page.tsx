import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Term { term: string; definition: string }

const TERMS: Term[] = [
  { term: 'PW (prevailing wage)', definition: 'Public-works rate type. CA DIR sets the wage floor by classification + county.' },
  { term: 'Private rate type', definition: 'Non-public work. Uses internal labor + equipment rates rather than prevailing wage.' },
  { term: 'Cost code', definition: 'Reusable line bucket. Estimates and actuals roll up here. Prefix groups: LAB / EQP / MAT / SUB / OH.' },
  { term: 'Imported estimate', definition: 'Estimate workbook saved into the system — Excel import or in-app builder.' },
  { term: 'Bid result', definition: 'Agency bid tabulation. Records every bidder, their amount, and the outcome.' },
  { term: 'Apparent low', definition: 'YGE rank #1 on the bid tab. Usually leads to WON_BY_YGE.' },
  { term: 'COI', definition: 'Certificate of insurance. Subs must have current named-additional-insured COI before working.' },
  { term: '§4104', definition: 'CA Public Contracts Code §4104 — list of subs submitted with a public-works bid. Must be filed within 24 hours.' },
  { term: 'CPR', definition: 'Certified payroll report — required weekly for prevailing-wage jobs.' },
  { term: 'BCC list', definition: 'Semicolon-joined list of email addresses used in mailto: links for one-to-many outreach.' },
  { term: 'Coverage %', definition: 'Percent of records that have a given field filled in (the inverse of "missing-X").' },
  { term: 'Multi-tenant', definition: 'Architecture where the same Postgres can hold rows for multiple companies. YGE only in the public preview.' },
  { term: 'Audit log', definition: 'Server-side record of every mutation. Who, what, when, before-state, after-state.' },
];

export default function AdminGlossaryPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin glossary" subtitle="Business + technical vocabulary used inside the app." />
        <dl className="space-y-3">
          {TERMS.map((t) => (
            <div key={t.term} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <dt className="text-sm font-semibold text-gray-900">{t.term}</dt>
              <dd className="text-sm text-gray-700">{t.definition}</dd>
            </div>
          ))}
        </dl>
      </main>
    </AppShell>
  );
}
