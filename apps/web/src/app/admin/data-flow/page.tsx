import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function DataFlowPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Data flow" subtitle="How data moves through the YGE app, top to bottom." />

        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-800 shadow-sm">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Browser → Web (Next.js)</h2>
            <p>Each page is a server-side React component that runs in Vercel. It either calls the API directly via fetch (client components) or composes server-side data with public env values.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Web → API (Express)</h2>
            <p>Fetches go to the API host configured by <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_API_URL</code>. Requests carry no cookies / auth tokens today; once auth ships, an Authorization header carries a Supabase JWT.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">API → Postgres (Prisma)</h2>
            <p>Express handlers parse input through Zod, then talk to Postgres via Prisma. Every mutation runs through audit middleware that captures who-what-when.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Files / storage</h2>
            <p>The browser never talks to Supabase Storage directly. Uploads + downloads always proxy through the API so we can scan, audit, and enforce permissions.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">AI calls</h2>
            <p>Anthropic Claude calls run server-side from the API only. The Anthropic API key never reaches the browser. Prompts live in <code className="rounded bg-gray-100 px-1">apps/api/src/lib/prompts</code>.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">CSV import / export</h2>
            <p>CSV uploads land at <code className="rounded bg-gray-100 px-1">multer</code> middleware, are parsed in-memory, validated row-by-row, then upserted in a single transaction. Exports stream from Prisma → text/csv response.</p>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
