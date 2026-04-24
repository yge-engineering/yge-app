// Temporary server component — will wire up to the API in Phase 1 weeks 2-3.

export default function JobsPage() {
  const jobs: Array<{ id: string; number: string; name: string; status: string }> = [
    {
      id: 'placeholder',
      number: '26-001',
      name: 'Sulphur Springs Road Improvement',
      status: 'Bidding',
    },
  ];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-yge-blue-500">Jobs</h1>
        <button className="rounded bg-yge-blue-500 px-4 py-2 text-white hover:bg-yge-blue-700">
          New Job
        </button>
      </div>

      <table className="mt-8 w-full border-collapse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <thead className="bg-yge-blue-500 text-left text-sm uppercase tracking-wide text-white">
          <tr>
            <th className="px-4 py-3">Job #</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-gray-100">
              <td className="px-4 py-3 font-mono text-sm">{j.number}</td>
              <td className="px-4 py-3">{j.name}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                  {j.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
