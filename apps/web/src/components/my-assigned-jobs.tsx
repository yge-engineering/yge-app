// MyAssignedJobs — foreman-facing tile on /profile that lists every
// job they've been assigned. Helps foremen quickly jump to the job
// detail without going through /jobs.
//
// Server component. Falls back to empty when the user is anonymous,
// not a FOREMAN, or has no jobs assigned. Hidden entirely for
// owners / office / PM (they see all jobs anyway via /jobs).

import Link from 'next/link';
import type { Job, PortalUser } from '@yge/shared';

interface Props {
  /** PortalUser record for the signed-in user. */
  me: PortalUser | null;
  /** All jobs from /api/jobs — we filter by assignedJobIds here. */
  jobs: Job[];
}

export function MyAssignedJobs({ me, jobs }: Props) {
  if (!me || me.role !== 'FOREMAN') return null;
  const allowed = new Set(me.assignedJobIds);
  const mine = jobs.filter((j) => allowed.has(j.id));
  if (mine.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Your assigned jobs
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          No jobs assigned yet. Ryan or the office sets these on{' '}
          <code className="rounded bg-gray-100 px-1 font-mono text-[10px]">
            /admin/portal-users
          </code>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">
        Your assigned jobs ({mine.length})
      </h2>
      <ul className="mt-2 divide-y divide-gray-100">
        {mine.map((j) => (
          <li
            key={j.id}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <Link
              href={`/jobs/${j.id}`}
              className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline"
            >
              {j.projectName}
            </Link>
            <span className="shrink-0 text-xs text-gray-500">{j.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
