import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Term { term: string; short: string; long: string }

const TERMS: Term[] = [
  {
    term: 'PW (prevailing wage)',
    short: 'Public-works rate type.',
    long: 'California DIR sets the wage + fringe floor by craft and county. PW work requires Certified Payroll Reports (CPRs) every week and a DIR public-works contractor registration. The app stores rateType per job + per labor rate row so costing flows from the right table.',
  },
  {
    term: 'Cost code',
    short: 'Reusable line bucket.',
    long: 'A short identifier (e.g. LAB-7100) that groups budget vs actual. Estimates roll up by code; daily reports roll up by code. Prefixes give a quick visual: LAB = labor, EQP = equipment, MAT = materials, SUB = subcontract, OH = overhead.',
  },
  {
    term: 'Apparent low',
    short: 'YGE was rank #1 on the agency bid tab.',
    long: 'Being the lowest bidder does not always mean awarded. Protests, scope reductions, or owner re-bids can flip it. The system tracks rank explicitly so we can spot trends where being low does not lead to win.',
  },
  {
    term: '§4104',
    short: 'CA Public Contracts Code subcontractor disclosure.',
    long: 'For any public-works bid > $5K, prime must file the list of subs >0.5% of bid value with the agency within the prescribed period. The list cannot be modified after award without owner consent. Future: a button on the bid result page that opens a §4104-formatted PDF.',
  },
  {
    term: 'COI',
    short: 'Certificate of insurance from a subcontractor.',
    long: 'ACORD 25 form. Must show YGE as additional insured, primary non-contributory, with waiver of subrogation, before the sub can start on a YGE project. The COI aging report tracks expiration windows.',
  },
  {
    term: 'CPR',
    short: 'Certified Payroll Report.',
    long: 'Weekly payroll certification required on PW jobs. Format is PWC-100 in CA. Includes employee name, classification, hours, gross, deductions, net per day. Future: auto-gen from timecards.',
  },
  {
    term: 'Plans-to-Estimate',
    short: 'AI workflow that produces a first-draft estimate from a plan set + specs.',
    long: 'Upload PDF plan set + specifications. Anthropic Claude analyzes scope, identifies items, queries the master rate book, returns a confidence-scored line-item estimate. Human review required before commit. Accuracy grows from paired training data we collect on each bid.',
  },
];

export default function GlossaryExtendedPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Glossary (extended)" subtitle="Longer-form definitions of terms used in the YGE app." />
        <div className="space-y-3">
          {TERMS.map((t) => (
            <details key={t.term} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">{t.term} — <span className="font-normal text-gray-600">{t.short}</span></summary>
              <p className="mt-2 text-sm text-gray-700">{t.long}</p>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
