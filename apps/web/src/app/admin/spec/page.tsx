import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function SpecPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Spec" subtitle="One-pager describing what the YGE app is and how it's organized." />

        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-800 shadow-sm">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Purpose</h2>
            <p>The YGE app replaces Excel + QuickBooks for Young General Engineering. Single source of truth for jobs, bids, vendors, employees, master rate book, and field reporting.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Tech</h2>
            <p>Next.js 14 App Router (web) · Node + Express (api) · Postgres + Prisma · Supabase auth/storage · Vercel (web) · Render (api). Strict TypeScript everywhere; zod for runtime validation.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Page surface</h2>
            <p>Public preview has 300+ pages organized into:</p>
            <ul className="ml-6 list-disc">
              <li>Top-level landings — <Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link>, <Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link>, <Link href="/sitemap" className="text-yge-blue-700 hover:underline">/sitemap</Link></li>
              <li>Master data list pages per entity</li>
              <li>Group-by analytic pages (by-status / by-state / by-kind / by-month / by-year / by-quarter / by-rate-type / by-day-of-week / by-amount-bucket / by-rank / by-bidder-count)</li>
              <li>Stats panels (count + share)</li>
              <li>Detail panels (expandable record lists)</li>
              <li>Data-quality views (missing-X) + their positive counterparts (with-X)</li>
              <li>Time-window filters (today / this-week / this-month / this-quarter / this-year / last-30-days)</li>
              <li>Hubs / indexes / catalog pages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Engineering rules</h2>
            <ul className="ml-6 list-disc">
              <li>No <code className="rounded bg-gray-100 px-1">any</code> in TypeScript</li>
              <li>Shared shapes live in <code className="rounded bg-gray-100 px-1">@yge/shared</code></li>
              <li>Money is integer cents</li>
              <li>Dates are ISO-8601</li>
              <li>Every mutation audit-logged</li>
              <li>Server-side Anthropic key only</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Roadmap</h2>
            <ul className="ml-6 list-disc">
              <li>Plans-to-Estimate AI</li>
              <li>Real audit log viewer</li>
              <li>Bond capacity (currently placeholder)</li>
              <li>Mobile responsive pass + Expo native shell</li>
              <li>AI bid letter draft</li>
              <li>PWC-100 CPR auto-gen from timecards</li>
              <li>Auth + roles wired through every page</li>
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
