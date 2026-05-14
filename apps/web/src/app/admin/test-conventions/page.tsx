import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { title: string; body: string }

const TOPICS: Topic[] = [
  {
    title: 'Vitest, not Jest',
    body: 'Faster startup, native ESM, no extra Babel config. Used across packages/shared and apps/api.',
  },
  {
    title: 'Every shared export gets a unit test',
    body: 'Each file under packages/shared/src/*.ts has a sibling *.test.ts. Pure functions, no DB.',
  },
  {
    title: 'Integration tests hit real Postgres',
    body: 'Via Testcontainers — a real ephemeral Postgres per suite. No mocked DB.',
  },
  {
    title: 'E2E via Playwright',
    body: 'Gated on CI. Runs against a dev Supabase project with fixture data.',
  },
  {
    title: 'Bundle pipeline runs tests on every commit',
    body: 'pnpm --filter @yge/shared test runs ~4,700 unit tests in ~8 seconds. Failures block the commit + push.',
  },
  {
    title: 'CI matches local',
    body: 'CI runs the same pnpm scripts a developer would run locally. No CI-only test config.',
  },
];

export default function TestConventionsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Test conventions" subtitle="How tests are organized + run in the YGE repo." />
        <ul className="space-y-3">
          {TOPICS.map((t, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{t.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
