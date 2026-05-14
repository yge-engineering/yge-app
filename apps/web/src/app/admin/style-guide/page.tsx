import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function StyleGuidePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Style guide" subtitle="Colors, typography, spacing conventions used in the YGE app." />

        <div className="space-y-5">
          <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Brand color</h2>
            <p className="mt-1 text-xs text-gray-600">Tailwind token <code className="rounded bg-gray-100 px-1">yge-blue-*</code> shows brand color from light to dark.</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[50, 100, 500, 700, 900].map((shade) => (
                <div key={shade} className={`rounded border border-gray-200 p-3 text-center bg-yge-blue-${shade}`}>
                  <div className="text-xs font-mono text-gray-700">{shade}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Semantic tones</h2>
            <p className="mt-1 text-xs text-gray-600">Used to color counts, pills, and table cells by good/bad/warn semantics.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">good</span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">warn</span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">bad</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">neutral</span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">info</span>
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">customer</span>
            </div>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Typography</h2>
            <ul className="ml-6 mt-2 list-disc text-xs text-gray-700">
              <li>Headings — Tailwind <code className="rounded bg-gray-100 px-1">text-sm font-semibold text-gray-900</code></li>
              <li>Body — <code className="rounded bg-gray-100 px-1">text-sm text-gray-700</code></li>
              <li>Mono / numeric — <code className="rounded bg-gray-100 px-1">font-mono text-xs</code></li>
              <li>Captions / metadata — <code className="rounded bg-gray-100 px-1">text-[10px] text-gray-500</code></li>
            </ul>
          </section>

          <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Cards + tables</h2>
            <p className="mt-1 text-xs text-gray-600">Cards and tables share the same outer border + shadow.</p>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs">
{`<div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">…</div>
<div className="rounded-lg border border-gray-200 bg-white shadow-sm">
  <table className="w-full text-sm">…</table>
</div>`}
            </pre>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
