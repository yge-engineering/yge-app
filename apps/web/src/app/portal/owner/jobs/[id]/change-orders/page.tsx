// /portal/owner/jobs/[id]/change-orders — full CO list grouped by status.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Money } from '../../../../../../components/money';
import { getCurrentUser } from '../../../../../../lib/auth';
import { currentUserCan } from '../../../../../../lib/permissions';
import { type ChangeOrder, type PortalUser } from '@yge/shared';

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

async function fetchChangeOrders(): Promise<ChangeOrder[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/change-orders`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { orders: ChangeOrder[] }).orders;
  } catch {
    return [];
  }
}

export default async function OwnerChangeOrdersPage({
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

  const all = await fetchChangeOrders();
  const cos = all
    .filter((c) => c.jobId === params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pending = cos.filter(
    (c) => c.status === 'PROPOSED' || c.status === 'AGENCY_REVIEW',
  );
  const approved = cos.filter(
    (c) => c.status === 'APPROVED' || c.status === 'EXECUTED',
  );
  const rejected = cos.filter(
    (c) => c.status === 'REJECTED' || c.status === 'WITHDRAWN',
  );

  const totalApproved = approved.reduce(
    (s, c) => s + c.totalCostImpactCents,
    0,
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
            All change orders ({cos.length})
          </h1>
          <p className="text-xs text-gray-600">
            {pending.length} pending · {approved.length} approved ·{' '}
            {rejected.length} rejected/withdrawn · approved total{' '}
            <Money cents={totalApproved} />
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {cos.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No change orders on this project yet.
          </p>
        ) : (
          <>
            <Section
              title="Pending review"
              items={pending}
              tone="warn"
            />
            <Section title="Approved" items={approved} tone="neutral" />
            <Section title="Rejected / Withdrawn" items={rejected} tone="muted" />
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
  items: ChangeOrder[];
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
        {items.map((c) => (
          <li key={c.id} className="p-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-mono text-xs text-gray-700">
                #{c.changeOrderNumber}
              </div>
              <span className="font-mono text-sm font-semibold text-gray-900">
                <Money cents={c.totalCostImpactCents} />
              </span>
            </div>
            <div className="mt-1 font-semibold text-gray-900">
              {c.subject || '(no subject)'}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
              {c.status} · filed {c.createdAt.slice(0, 10)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
