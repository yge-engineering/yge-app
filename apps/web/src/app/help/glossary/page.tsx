import { AppShell, PageHeader } from '../../../components';

interface Term { term: string; definition: string }

const TERMS: Term[] = [
  { term: 'Bid result', definition: 'A recorded agency bid tabulation. Stores every bidder, their amount, and the outcome (WON_BY_YGE / WON_BY_OTHER / NO_AWARD / TBD).' },
  { term: 'Apparent low', definition: 'YGE was rank #1 (lowest bidder) on an agency tab. Usually leads to a WON_BY_YGE outcome but not always — protests, scope re-bid, etc. can change it.' },
  { term: 'Hit rate', definition: 'Awarded jobs divided by decided jobs (awarded + lost). TBD / NO_AWARD outcomes are excluded so the percentage reflects actual decisions.' },
  { term: 'Rate type', definition: 'PW (prevailing wage, public agency work) or Private. Drives which labor + equipment cents value is used when costing an estimate line.' },
  { term: 'Cost code', definition: 'A reusable bucket that lines roll up under. Codes are prefixed by discipline (LAB- for labor, EQP- for equipment, MAT- for materials, SUB- for subs, OH- for overhead).' },
  { term: 'Imported estimate', definition: 'A bid workbook saved into the system — either built in YGE or imported from an Excel sheet — that lists each cost-code line, quantity, and total cost cents.' },
  { term: 'Owned vs rental', definition: 'Equipment in the rate book is one of two kinds: OWNED (we have it) or RENTAL (we rent it). Owned shows only an hourly rate; rental can show hourly + daily + weekly + monthly + vendor.' },
  { term: 'COI aging', definition: 'Time bucket showing how soon a subcontractor\'s certificate of insurance expires. Used to chase down sub renewals before they lapse.' },
  { term: 'BCC list', definition: 'A semicolon-joined list of email addresses used in mailto: links so we can send one outreach email to many recipients without exposing addresses to each other.' },
];

export default function GlossaryPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Glossary" subtitle="Plain-English definitions of the terms you'll see across the YGE app." />
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
