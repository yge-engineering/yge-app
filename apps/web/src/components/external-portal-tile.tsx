import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — count of external portal users by role.

import Link from 'next/link';
import type { PortalUser } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchUsers(): Promise<PortalUser[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/portal-users`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { users?: PortalUser[] };
    return body.users ?? [];
  } catch {
    return [];
  }
}

async function ExternalPortalTileInner() {
  const users = await fetchUsers();
  if (users.length === 0) return null;

  const owners = users.filter((u) => u.role === 'EXTERNAL_OWNER');
  const subs = users.filter((u) => u.role === 'EXTERNAL_SUB');
  const bonds = users.filter((u) => u.role === 'EXTERNAL_BOND');
  const externalCount = owners.length + subs.length + bonds.length;
  if (externalCount === 0) return null;

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          External portals — {externalCount} user
          {externalCount === 1 ? '' : 's'} active
        </h2>
        <Link
          href="/admin/portal-users"
          className="text-xs text-yge-blue-700 hover:underline"
        >
          Manage portal users →
        </Link>
      </header>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Agency owners</div>
          <div className="mt-1 font-mono text-lg font-bold">
            {owners.length}
          </div>
          <Link
            href="/portal/owner"
            className="text-[11px] text-yge-blue-700 hover:underline"
          >
            Preview /portal/owner →
          </Link>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Subs</div>
          <div className="mt-1 font-mono text-lg font-bold">{subs.length}</div>
          <Link
            href="/portal/sub"
            className="text-[11px] text-yge-blue-700 hover:underline"
          >
            Preview /portal/sub →
          </Link>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Bond agents</div>
          <div className="mt-1 font-mono text-lg font-bold">{bonds.length}</div>
          <Link
            href="/portal/bond"
            className="text-[11px] text-yge-blue-700 hover:underline"
          >
            Preview /portal/bond →
          </Link>
        </div>
      </div>
    </section>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function ExternalPortalTile(): Promise<React.ReactElement | null> {
  try {
    return await ExternalPortalTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[ExternalPortalTile] render failed:', err);
    return null;
  }
}

