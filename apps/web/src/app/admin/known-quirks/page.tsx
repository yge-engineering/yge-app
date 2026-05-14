import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Quirk { title: string; description: string; workaround?: string }

const QUIRKS: Quirk[] = [
  {
    title: 'Express route ordering matters',
    description: 'Literal paths must be declared before parameterized ones (/foo/bar before /foo/:id). Otherwise Express treats "bar" as an id.',
    workaround: 'Always add literal routes at the top of each router file.',
  },
  {
    title: 'Vitest sometimes SIGABRT during bulk runs',
    description: 'Vitest 1.6.1 occasionally crashes the worker with abort trap 6 under sustained load. Tests + code are fine; the runner just gave up.',
    workaround: 'Re-run the failed bundle. The bundle pipeline already does this on a manual re-queue.',
  },
  {
    title: 'Bundle script "nothing to commit" false positive',
    description: 'Sometimes the watcher runs a bundle twice. The first run lands a commit; the second sees a clean working tree and exits 1 ("nothing to commit"). Bundle gets flagged FAILED even though it shipped.',
    workaround: 'Verify the commit landed via /admin/build-info or git log; if so, ignore the FAILED flag.',
  },
  {
    title: 'Editing existing JSX files via regex node scripts can corrupt them',
    description: 'Earlier in the session, multi-pass regex replacements on bid-summary-tile.tsx duplicated and concatenated content. Recovered via git checkout HEAD --.',
    workaround: 'Prefer the Edit tool with full-context strings. Never apply node-script regex passes to JSX files.',
  },
  {
    title: 'NoUncheckedIndexedAccess + array.indexOf',
    description: 'TypeScript is strict; arr[i] returns T | undefined. Common at bundle build time when bundles iterate a sorted array.',
    workaround: 'Either non-null assertion when index is provably valid, or default to a fallback value.',
  },
  {
    title: 'pnpm + monorepo + dep changes',
    description: 'Touching package.json deps requires re-running pnpm install and committing pnpm-lock.yaml in the same bundle. Otherwise CI breaks on the next deploy.',
    workaround: 'Bundle the lockfile alongside the package.json change.',
  },
];

export default function KnownQuirksPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Known quirks" subtitle="Footguns + workarounds I have hit while building the YGE app." />
        <div className="space-y-3">
          {QUIRKS.map((q, i) => (
            <article key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{q.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{q.description}</p>
              {q.workaround ? (
                <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800"><b>Workaround:</b> {q.workaround}</p>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
