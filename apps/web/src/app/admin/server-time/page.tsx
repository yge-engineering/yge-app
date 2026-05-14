import { AppShell, PageHeader } from '../../../components';

export default function ServerTimePage() {
  const now = new Date();
  const intlFormatter = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'long',
    dateStyle: 'full',
    timeStyle: 'long',
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Server time" subtitle="When the server processed this request and which time zone it is in." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Local time</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{intlFormatter.format(now)}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">UTC ISO</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{now.toISOString()}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Detected time zone</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{tz}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Process uptime (s)</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.uptime().toFixed(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Time stamps from the server are stored in UTC; "today" filters convert to local time at render.
        </p>
      </main>
    </AppShell>
  );
}
