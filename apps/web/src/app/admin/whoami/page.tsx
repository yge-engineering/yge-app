import { AppShell, PageHeader } from '../../../components';

export default function WhoamiPage() {
  // No requirePermission — this page is intentionally accessible to any
  // signed-in user so they can confirm what role/permission they have.
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Who am I?" subtitle="Quick identity + permissions readout (server-side, current request)." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Default company</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.DEFAULT_COMPANY_ID ?? 'yge-root'}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">API base URL</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.NEXT_PUBLIC_API_URL ?? '—'}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Node env</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.NODE_ENV ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Auth is not wired into the public preview yet — this is a placeholder for the full
          identity panel that will show the signed-in user, role, and effective permissions.
        </p>
      </main>
    </AppShell>
  );
}
