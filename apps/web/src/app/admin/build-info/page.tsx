import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row { label: string; value: string }

function rows(): Row[] {
  const out: Row[] = [];
  out.push({ label: 'Web hostname', value: process.env.VERCEL_URL ?? '—' });
  out.push({ label: 'Vercel env', value: process.env.VERCEL_ENV ?? '—' });
  out.push({ label: 'Vercel region', value: process.env.VERCEL_REGION ?? '—' });
  out.push({ label: 'Git commit SHA', value: process.env.VERCEL_GIT_COMMIT_SHA ?? '—' });
  out.push({ label: 'Git branch', value: process.env.VERCEL_GIT_COMMIT_REF ?? '—' });
  out.push({ label: 'Last commit message', value: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? '—').slice(0, 200) });
  out.push({ label: 'API base URL', value: process.env.NEXT_PUBLIC_API_URL ?? '—' });
  out.push({ label: 'Node version', value: process.version });
  return out;
}

export default function BuildInfoPage() {
  requirePermission('audit:view');
  const r = rows();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Build info" subtitle="Server-side env values relevant to this deployment." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              {r.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="w-1/3 px-3 py-2 font-semibold text-gray-700">{row.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-900">{row.value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Values are read from env at request time. Empty values usually mean the variable isn't set in this environment.
        </p>
      </main>
    </AppShell>
  );
}
