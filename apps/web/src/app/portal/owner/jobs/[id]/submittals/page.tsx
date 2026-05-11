// /portal/owner/jobs/[id]/submittals — full submittals list grouped by status.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '../../../../../../lib/auth';
import { currentUserCan } from '../../../../../../lib/permissions';
import { type PortalUser, type Submittal } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPortalUser(email: string): Promise<PortalUser | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: PortalUser };
    return body.user ?? null;
  } catch {
    return null;
  }
}

async function fetchSubmittals(): Promise<Submittal[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/submittals`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { submittals: Submittal[] }).submittals;
  } catch {
    return [];
  }
}

export default async function OwnerSubmittalsPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const user = await fetchPortalUser(me?.email ?? '');
  if (!user) redirect('/portal/owner');
  if (!(user.assignedJobIds ?? []).includes(params.id)) notFound();

  const all = await fetchSubmittals();
  const submittals = all
    .filter((s) => s.jobId === params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/portal/owner/jobs/${params.id}`}
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            All submittals ({submittals.length})
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
        {submittals.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No submittals logged on this project yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white text-sm">
            {submittals.map((s) => (
              <li key={s.id} className="p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-mono text-xs text-gray-700">
                    #{s.submittalNumber}
                    {s.revision ? ` Rev ${s.revision}` : ''}
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    {s.status}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-gray-900">
                  {s.subject || s.specSection || '(no subject)'}
                </div>
                {s.specSection ? (
                  <p className="mt-1 text-xs text-gray-700">
                    Spec section: {s.specSection}
                  </p>
                ) : null}
                <div className="mt-1 text-[11px] text-gray-500">
                  Logged {s.createdAt.slice(0, 10)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
