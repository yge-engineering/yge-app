// /help — keyboard shortcuts + 'what's where' feature index.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';

interface Shortcut {
  keys: string;
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: '/', description: 'Open search on the imported-estimates list' },
  { keys: 'g d', description: 'Go to dashboard' },
  { keys: 'g j', description: 'Go to jobs' },
  { keys: 'g e', description: 'Go to imported estimates' },
  { keys: 'g r', description: 'Go to reports' },
  { keys: 'g c', description: 'Go to customers' },
  { keys: 'Tab / Shift+Tab', description: 'Move between cells in the estimate editor' },
  { keys: 'Enter', description: 'Save the current cell and stay' },
];

interface FeatureCard {
  href: string;
  title: string;
  blurb: string;
}

const QUICK_FEATURES: FeatureCard[] = [
  { href: '/bids/calendar', title: 'Bid calendar', blurb: 'Upcoming bid deadlines by week.' },
  { href: '/imported-estimates', title: 'Imported estimates', blurb: 'Every estimate from Excel.' },
  { href: '/imported-estimates/search', title: 'Search bids', blurb: 'Full-text search across estimates.' },
  { href: '/imported-estimates/compare', title: 'Compare two bids', blurb: 'Side-by-side cost-code diff.' },
  { href: '/customers/touchpoints', title: 'Customer dormancy', blurb: 'Who haven\'t we talked to recently.' },
  { href: '/cost-codes', title: 'Cost code master', blurb: 'Codes + top-10 spend.' },
  { href: '/cost-codes/trends', title: 'Cost code trends', blurb: 'Climbing / falling unit costs.' },
  { href: '/vendors/scorecard', title: 'Sub scorecard', blurb: 'Paid, open, days-to-pay per sub.' },
  { href: '/equipment-rates/usage', title: 'Equipment usage', blurb: 'Bid vs actual per piece.' },
  { href: '/employees/utilization', title: 'Labor utilization', blurb: 'Weekly hours per employee.' },
  { href: '/bid-results/by-agency', title: 'Win rate by agency', blurb: 'Color-coded win rates.' },
  { href: '/reports', title: 'Reports hub', blurb: 'All 50+ analyses on one page.' },
];

export default function HelpPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Help & shortcuts"
          subtitle="Where things live + how to move around fast."
        />

        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">
            Keyboard shortcuts
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys} className="border-t border-gray-100">
                  <td className="py-1 pr-4">
                    <kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs">
                      {s.keys}
                    </kbd>
                  </td>
                  <td className="py-1 text-gray-700">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            (Shortcuts marked g-prefix not yet wired — placeholder. The /
            search keystroke is wired in the keyboard-nav helper.)
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">
            Quick features
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {QUICK_FEATURES.map((f) => (
              <li key={f.href}>
                <Link
                  href={f.href}
                  className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
                >
                  <div className="text-sm font-semibold text-yge-blue-900">{f.title}</div>
                  <p className="text-xs text-gray-600">{f.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
// 1699 kick
