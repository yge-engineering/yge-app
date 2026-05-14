import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function SystemInfoPage() {
  requirePermission('audit:view');
  const now = new Date();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="System info" subtitle="Quick at-a-glance combining build, time, and health context." />

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Server time (UTC ISO)</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{now.toISOString()}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Process uptime (s)</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.uptime().toFixed(0)}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Node version</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.version}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Vercel env</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.VERCEL_ENV ?? '—'}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Git commit SHA</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.VERCEL_GIT_COMMIT_SHA ?? '—'}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">Git branch</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.VERCEL_GIT_COMMIT_REF ?? '—'}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">API base URL</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-900">{process.env.NEXT_PUBLIC_API_URL ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul className="mt-4 list-disc pl-6 text-sm text-gray-700">
          <li><Link href="/admin/build-info" className="text-yge-blue-700 hover:underline">/admin/build-info</Link> — full build env dump</li>
          <li><Link href="/admin/server-time" className="text-yge-blue-700 hover:underline">/admin/server-time</Link> — server-side time + tz</li>
          <li><Link href="/admin/health-check" className="text-yge-blue-700 hover:underline">/admin/health-check</Link> — friendly /api/admin/health</li>
        </ul>
      </main>
    </AppShell>
  );
}
