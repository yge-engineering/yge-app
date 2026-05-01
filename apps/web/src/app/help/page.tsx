// /help — first-day help page.
//
// Plain English: the cheat-sheet for the most common workflows.
// Aimed at someone who just logged in and doesn't know where to
// start. Will grow as we land more features.

import { AppShell, Card, LinkButton, PageHeader } from '../../components';

interface HowTo {
  title: string;
  steps: string[];
  done: { label: string; href: string };
}

const HOW_TOS: HowTo[] = [
  {
    title: 'Start a new bid',
    steps: [
      'Go to Jobs (sidebar) and click "+ New job". Fill in the project name, agency, and contract type.',
      'Open the job, scroll to "Estimates", click "Plans-to-Estimate (AI)" to upload the plan PDF.',
      'AI drafts a take-off + quantities. Review, edit, click "Promote to estimate".',
      'Open the estimate, set unit prices, hit "Print bid envelope" — that gives you the cover letter, sub list, addenda acks, and last-mile manifest.',
    ],
    done: { label: 'Open Jobs', href: '/jobs' },
  },
  {
    title: 'Log a daily report',
    steps: [
      'Open Daily reports (sidebar). Click "+ New daily report".',
      'Pick the job and date. The system pulls today\'s dispatch as the starting crew list.',
      'Add start / end / lunch times for each crew member. CA meal-break violations highlight in red — fix them or note the waiver.',
      'Fill in scope-completed, issues, visitors. Submit.',
    ],
    done: { label: 'Open Daily reports', href: '/daily-reports' },
  },
  {
    title: 'Send an AR invoice',
    steps: [
      'Open AR invoices. Click "+ New invoice".',
      'Pick the customer + job. Add line items.',
      'Save → Print. You get a PDF on YGE letterhead with the right CSLB number printed.',
      'Email or mail the PDF. Mark "Sent" in the app once it goes out.',
    ],
    done: { label: 'Open AR invoices', href: '/ar-invoices' },
  },
  {
    title: 'Run weekly certified payroll',
    steps: [
      'Open Time cards. Confirm every employee\'s week is submitted + approved.',
      'Open Certified payrolls → "+ New". Pick the week + the public-works job.',
      'System pulls hours from time cards, applies DIR rates from /dir-rates, generates the A-1-131 form.',
      'Review, sign electronically, file with DIR or download for paper filing.',
    ],
    done: { label: 'Open Certified payrolls', href: '/certified-payrolls' },
  },
];

const FAQS = [
  {
    q: 'Where do I change company info (logo, address, license number)?',
    a: 'Brand kit page (sidebar → All modules → Records → Brand kit). Anything you change there flows into every printed document.',
  },
  {
    q: 'How do I add a new employee?',
    a: 'Employees (sidebar) → "+ New employee". Fill in name, role, classification (used for prevailing wage), hire date.',
  },
  {
    q: 'What\'s the difference between Drafts and Estimates?',
    a: 'A draft is a take-off in progress — quantities only, no prices. An estimate is the priced version, ready to bid. Drafts get promoted to estimates once you set unit prices.',
  },
  {
    q: 'Why does the dashboard show 0s for everything?',
    a: 'The API server probably isn\'t running locally. Once we deploy the API to a real server (or you start it with `pnpm dev` in apps/api), the tiles will fill in.',
  },
  {
    q: 'How do I get back to the dashboard?',
    a: 'Click the YGE logo in the upper left. Or click "Dashboard" in the sidebar.',
  },
];

export default function HelpPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title="Help"
          subtitle="Plain-English how-tos for the things you'll do most. Bookmark this page for the first month."
        />

        <section className="mb-10">
          <h2 className="mb-4 text-base font-semibold text-gray-900">How-tos</h2>
          <div className="space-y-4">
            {HOW_TOS.map((h) => (
              <Card key={h.title}>
                <h3 className="text-sm font-semibold text-gray-900">{h.title}</h3>
                <ol className="mt-3 space-y-2 text-sm text-gray-700">
                  {h.steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-xs text-gray-400">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4">
                  <LinkButton href={h.done.href} variant="primary" size="sm">
                    {h.done.label}
                  </LinkButton>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Common questions</h2>
          <dl className="space-y-3">
            {FAQS.map((f) => (
              <Card key={f.q}>
                <dt className="text-sm font-medium text-gray-900">{f.q}</dt>
                <dd className="mt-1 text-sm text-gray-700">{f.a}</dd>
              </Card>
            ))}
          </dl>
        </section>

        <p className="mt-10 text-center text-xs text-gray-400">
          Stuck? Call Ryan at 707-599-9921.
        </p>
      </main>
    </AppShell>
  );
}
