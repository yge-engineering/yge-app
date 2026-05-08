// /portal/sub — subcontractor portal landing.
//
// External users (EXTERNAL_SUB role). Phase 3 v1 surfaces a simple
// "your account" view with the subs' info from PortalUser; future
// bundles tie in lien waivers, POs, bid invites once those data
// streams gain a sub-facing view.

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '../../../lib/auth';
import { currentUserCan } from '../../../lib/permissions';
import type { PortalUser, Vendor } from '@yge/shared';

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

async function fetchVendors(): Promise<Vendor[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/vendors`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { vendors: Vendor[] }).vendors;
  } catch {
    return [];
  }
}

export default async function SubPortalPage() {
  if (!currentUserCan('portal:sub')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const [user, vendors] = await Promise.all([
    fetchPortalUser(me?.email ?? ''),
    fetchVendors(),
  ]);

  // Match this portal user to a Vendor by email so we can show
  // "you are <Vendor X>" and (later) their open commitments.
  const matchedVendor = me?.email
    ? vendors.find(
        (v) => v.email && v.email.toLowerCase() === me.email.toLowerCase(),
      )
    : undefined;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-yge-blue-900">
              Young General Engineering — sub portal
            </h1>
            <p className="text-xs text-gray-600">
              Welcome, {me?.name ?? me?.email ?? 'sub'}.
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

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Account
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Sign-in email</dt>
              <dd className="font-mono">{me?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Vendor record</dt>
              <dd>{matchedVendor?.legalName ?? '— (no match)'}</dd>
            </div>
            {matchedVendor ? (
              <>
                <div>
                  <dt className="text-xs text-gray-500">CSLB license</dt>
                  <dd className="font-mono">
                    {matchedVendor.cslbLicense ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">W-9 on file</dt>
                  <dd className={matchedVendor.w9OnFile ? 'text-green-800' : 'text-red-700'}>
                    {matchedVendor.w9OnFile ? '✓ Yes' : '✗ No — please send a current W-9 to office@youngge.com'}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Open commitments
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            POs, lien waivers, and bid invites will appear here once
            the office wires you to your vendor record. For now,
            email{' '}
            <a
              href="mailto:office@youngge.com"
              className="text-yge-blue-700 underline"
            >
              office@youngge.com
            </a>{' '}
            for any document or invoice questions.
          </p>
        </section>

        {user ? (
          <p className="text-[11px] text-gray-500">
            Signed in as {user.email} · role {user.role}.
          </p>
        ) : null}
      </div>
    </main>
  );
}
