import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold text-yge-blue-500">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Your morning briefing, open jobs, bids due this week, and field activity.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LinkCard
          title="Plans-to-Estimate"
          body="Paste an RFP or spec, get a draft bid item list back."
          href="/plans-to-estimate"
          cta="Open"
        />
        <LinkCard
          title="Saved Drafts"
          body="Re-open any prior AI run without paying Anthropic to redraft."
          href="/drafts"
          cta="Browse"
        />
        <LinkCard
          title="Priced Estimates"
          body="Convert a draft to an editable estimate, fill in unit prices, see the running bid total."
          href="/estimates"
          cta="Open"
        />
        <Card title="Open Bids" body="Nothing yet — dashboard wired up in Phase 1 weeks 3-4." />
        <Card title="Active Jobs" body="Job list here." />
        <Card title="Morning Briefing" body="AI-generated daily summary lands here." />
      </div>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <p className="mt-2 text-gray-700">{body}</p>
    </div>
  );
}

function LinkCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-yge-blue-200 bg-yge-blue-50 p-6 shadow-sm transition hover:border-yge-blue-500 hover:shadow"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-700">{title}</h3>
      <p className="mt-2 text-gray-700">{body}</p>
      <p className="mt-3 text-sm font-semibold text-yge-blue-700">{cta} &rarr;</p>
    </Link>
  );
}
