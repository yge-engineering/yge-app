// /dashboard — MINIMAL static version.
//
// The full dashboard (preserved at dashboard/page-full.tsx.bak) was
// crashing on SSR with a non-actionable error in production. While
// we debug it, this version gives Ryan and Brook a working landing
// page with sidebar nav + curated quick-links.
//
// Restoration plan: once we identify the bug (via Vercel logs or
// /admin/errors capture), fix it in the .bak file and rename it
// back to page.tsx.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../components';
import { getCurrentUser } from '../../lib/auth';

export default function DashboardPage() {
  let firstName = '';
  try {
    const user = getCurrentUser();
    if (user?.name) firstName = user.name.split(' ')[0] ?? '';
  } catch {
    // ignore
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <PageHeader
          title={firstName ? `Welcome back, ${firstName}` : 'YGE App'}
          subtitle="The full dashboard is temporarily simplified while we resolve a runtime error. Use the quick-links below or the sidebar to get to any page."
        />

        <section className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            <strong>Heads up:</strong> the rich dashboard tiles
            (cash position, AR aging, close progress, risk register,
            etc.) are temporarily hidden while we fix a server-render
            crash. Every page works — only the dashboard tile grid is
            paused. Use the links below or the sidebar.
          </p>
        </section>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Daily decisions
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li>
              <Link href="/morning-briefing" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Morning briefing
              </Link>
            </li>
            <li>
              <Link href="/risk-register" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Risk register
              </Link>
            </li>
            <li>
              <Link href="/cash-position" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Cash position
              </Link>
            </li>
            <li>
              <Link href="/aging" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → AR + AP aging
              </Link>
            </li>
            <li>
              <Link href="/ap-check-run" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → AP check run
              </Link>
            </li>
            <li>
              <Link href="/me/today" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → My day
              </Link>
            </li>
          </ul>
        </section>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Money + reports
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li>
              <Link href="/reports" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Reports directory
              </Link>
            </li>
            <li>
              <Link href="/executive-snapshot" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Executive snapshot
              </Link>
            </li>
            <li>
              <Link href="/vendor-spend" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Vendor spend
              </Link>
            </li>
            <li>
              <Link href="/customer-concentration" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Customer concentration
              </Link>
            </li>
            <li>
              <Link href="/1099-worksheet" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → 1099 worksheet
              </Link>
            </li>
            <li>
              <Link href="/period-close" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Monthly close
              </Link>
            </li>
          </ul>
        </section>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Projects + compliance
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li>
              <Link href="/jobs" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Jobs
              </Link>
            </li>
            <li>
              <Link href="/estimates" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Estimates
              </Link>
            </li>
            <li>
              <Link href="/dispatch" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Dispatch
              </Link>
            </li>
            <li>
              <Link href="/daily-reports" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Daily reports
              </Link>
            </li>
            <li>
              <Link href="/lien-waivers" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Lien waivers
              </Link>
            </li>
            <li>
              <Link href="/certified-payrolls" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Certified payrolls
              </Link>
            </li>
          </ul>
        </section>

        <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Admin
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li>
              <Link href="/admin/health" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → System health
              </Link>
            </li>
            <li>
              <Link href="/admin/data-health" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Data health
              </Link>
            </li>
            <li>
              <Link href="/admin/errors" className="block rounded border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-yge-blue-700 hover:bg-gray-100">
                → Server errors
              </Link>
            </li>
          </ul>
        </section>

        <p className="text-[11px] text-gray-500">
          Full tile dashboard preserved at apps/web/src/app/dashboard/page-full.tsx.bak.
          Will be restored once the SSR error is identified.
        </p>
      </main>
    </AppShell>
  );
}
