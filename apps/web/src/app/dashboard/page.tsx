export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold text-yge-blue-500">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Your morning briefing, open jobs, bids due this week, and field activity.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
