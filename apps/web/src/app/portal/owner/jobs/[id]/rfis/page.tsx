// /portal/owner/jobs/[id]/rfis — full RFI list for one job.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '../../../../../../lib/auth';
import { currentUserCan } from '../../../../../../lib/permissions';
import { type PortalUser, type Rfi } from '@yge/shared';

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

async function fetchRfis(): Promise<Rfi[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/rfis`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { rfis: Rfi[] }).rfis;
  } catch {
    return [];
  }
}

export default async function OwnerRfisPage({
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

  const allRfis = await fetchRfis();
  const rfis = allRfis
    .filter((r) => r.jobId === params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const open = rfis.filter(
    (r) =>
      r.status !== 'CLOSED' &&
      r.status !== 'WITHDRAWN' &&
      r.status !== 'ANSWERED',
  );
  const answered = rfis.filter((r) => r.status === 'ANSWERED');
  const closed = rfis.filter(
    (r) => r.status === 'CLOSED' || r.status === 'WITHDRAWN',
  );

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
            All RFIs ({rfis.length})
          </h1>
          <p className="text-xs text-gray-600">
            {open.length} open · {answered.length} answered · {closed.length}{' '}
            closed
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {rfis.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No RFIs filed on this project yet.
          </p>
        ) : (
          <>
            <Section title="Open" items={open} tone="warn" />
            <Section title="Answered" items={answered} tone="neutral" />
            <Section title="Closed" items={closed} tone="muted" />
          </>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: Rfi[];
  tone: 'warn' | 'neutral' | 'muted';
}) {
  if (items.length === 0) return null;
  const headerClass =
    tone === 'warn'
      ? 'bg-amber-50 text-amber-900 border-amber-300'
      : tone === 'muted'
        ? 'bg-gray-100 text-gray-600 border-gray-200'
        : 'bg-white text-gray-800 border-gray-200';
  return (
    <section>
      <header
        className={`mb-2 rounded border px-3 py-2 text-sm font-semibold uppercase tracking-wide ${headerClass}`}
      >
        {title} ({items.length})
      </header>
      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white text-sm">
        {items.map((r) => (
          <li key={r.id} className="p-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-mono text-xs text-gray-700">
                #{r.rfiNumber}
              </div>
              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                {r.status}
              </span>
            </div>
            <div className="mt-1 font-semibold text-gray-900">
              {r.subject || '(no subject)'}
            </div>
            {r.question ? (
              <p className="mt-1 text-xs text-gray-700">
                {r.question.length > 240
                  ? r.question.slice(0, 240) + '…'
                  : r.question}
              </p>
            ) : null}
            <div className="mt-1 text-[11px] text-gray-500">
              Filed {r.createdAt.slice(0, 10)}
              {r.priority ? ` · priority ${r.priority}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
