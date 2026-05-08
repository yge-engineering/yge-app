// /portal/owner — owner / agency landing page.
//
// External users (EXTERNAL_OWNER role). Lists the jobs YGE is
// running for this owner, with each card linking to a read-only
// project view.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Money } from '../../../components/money';
import { getCurrentUser } from '../../../lib/auth';
import { currentUserCan } from '../../../lib/permissions';
import {
  bidDueCountdown,
  type Job,
  type PortalUser,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAssigned(email: string): Promise<{
  user: PortalUser | null;
  jobs: Job[];
}> {
  if (!email) return { user: null, jobs: [] };
  let user: PortalUser | null = null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const body = (await res.json()) as { user?: PortalUser };
      user = body.user ?? null;
    }
  } catch {
    /* swallow */
  }
  if (!user) return { user: null, jobs: [] };

  const ids = user.assignedJobIds ?? [];
  if (ids.length === 0) return { user, jobs: [] };

  // Resolve each assigned job by id. Sequential is fine — owners
  // typically have a handful of active projects, not hundreds.
  const jobs: Job[] = [];
  for (const id of ids) {
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) continue;
      const body = (await res.json()) as { job?: Job };
      if (body.job) jobs.push(body.job);
    } catch {
      /* swallow — keep going */
    }
  }
  return { user, jobs };
}

export default async function OwnerPortalPage() {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const { user, jobs } = await fetchAssigned(me?.email ?? '');

  const sorted = [...jobs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-yge-blue-900">
              Young General Engineering — owner portal
            </h1>
            <p className="text-xs text-gray-600">
              Welcome, {me?.name ?? me?.email ?? 'owner'}. Read-only view
              of the projects we're running for you.
            </p>
          </div>
          <Link
            href="/api/auth/logout"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {sorted.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No projects assigned to you yet. If this looks wrong, email{' '}
            <a
              href="mailto:office@youngge.com"
              className="text-yge-blue-700 underline"
            >
              office@youngge.com
            </a>{' '}
            and we'll wire up access.
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Your projects ({sorted.length})
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sorted.map((j) => {
                const due = j.bidDueDate
                  ? bidDueCountdown(j.bidDueDate, new Date())
                  : null;
                return (
                  <li key={j.id}>
                    <Link
                      href={`/portal/owner/jobs/${j.id}`}
                      className="block rounded-md border border-gray-200 bg-white p-4 hover:border-yge-blue-500 hover:bg-yge-blue-50"
                    >
                      <div className="font-semibold text-gray-900">
                        {j.projectName}
                      </div>
                      {j.location ? (
                        <div className="mt-0.5 text-xs text-gray-600">
                          {j.location}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-gray-700">
                          {j.status}
                        </span>
                        {j.engineersEstimateCents != null ? (
                          <span className="text-gray-700">
                            <Money cents={j.engineersEstimateCents} /> EE
                          </span>
                        ) : null}
                        {due ? (
                          <span
                            className={
                              due.level === 'red'
                                ? 'font-semibold text-red-700'
                                : due.level === 'orange' ||
                                    due.level === 'yellow'
                                  ? 'font-semibold text-amber-700'
                                  : 'text-gray-600'
                            }
                          >
                            Bid due {j.bidDueDate}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {user ? (
          <p className="mt-6 text-[11px] text-gray-500">
            Signed in as {user.email} · role {user.role}. Have a question
            on a project? Email the YGE PM listed on the project page or
            office@youngge.com.
          </p>
        ) : null}
      </div>
    </main>
  );
}
