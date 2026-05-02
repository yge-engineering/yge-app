// /pdf-forms — pre-mapped agency form library.
//
// Lists every PDF form mapping with the per-form fillability summary
// (auto-fills X of Y fields; you'll be asked for Z inline; W
// sensitive). Click a row to open the per-form preview / fill page
// — that's where the operator answers prompts and triggers the
// actual byte-rewriting.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  PageHeader,
  StatusPill,
} from '../../components';
import {
  computeFillability,
  computeFormLibraryRollup,
  summarizeFieldKinds,
  type PdfFormMapping,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse { mappings: PdfFormMapping[] }

async function fetchMappings(qs: URLSearchParams): Promise<PdfFormMapping[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/pdf-form-mappings?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).mappings;
  } catch { return []; }
}

interface SearchParams {
  agency?: string;
  reviewed?: string;
  search?: string;
}

export default async function PdfFormsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) qs.set(k, v);
  }
  const mappings = await fetchMappings(qs);
  const rollup = computeFormLibraryRollup(mappings);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/master-profile" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Master profile
          </Link>
          <span className="text-xs text-gray-500">
            {mappings.length} form{mappings.length === 1 ? '' : 's'} loaded
          </span>
        </div>

        <PageHeader
          title="PDF form library"
          subtitle="Pre-mapped agency forms — CAL FIRE, Caltrans, DIR, IRS, ACORD, counties. Pick a form, answer any inline prompts, get a filled-and-flattened PDF back."
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Forms in library" value={String(rollup.total)} />
          <Tile label="Reviewed" value={String(rollup.reviewedCount)} tone="success" />
          <Tile label="Drafts (need review)" value={String(rollup.draftCount)} tone="warn" />
        </section>

        {mappings.length === 0 ? (
          <Alert tone="info" className="mt-6">
            No form mappings loaded yet. The seeded library (CAL FIRE 720,
            DAS-140 / DAS-142, PWC-100, IRS W-9, ACORD 25, top county
            packets) ships in the next bundle. In the meantime, the
            POST /api/pdf-form-mappings endpoint accepts custom mappings.
          </Alert>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Form</th>
                  <th className="px-3 py-2 text-left">Agency</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Fillability</th>
                  <th className="px-3 py-2 text-left">Field mix</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map((m) => {
                  const fill = computeFillability(m.fields);
                  const kinds = summarizeFieldKinds(m.fields);
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{m.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {m.formCode ?? '—'}{m.versionDate && ` · v${m.versionDate}`}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-gray-700">
                        {m.agency}
                      </td>
                      <td className="px-3 py-2">
                        {m.reviewed ? (
                          <StatusPill label="REVIEWED" tone="success" size="sm" />
                        ) : (
                          <StatusPill label="DRAFT" tone="warn" size="sm" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <div className="font-mono text-gray-900">
                          {fill.autoFillCount} / {fill.total} auto
                        </div>
                        {fill.promptCount > 0 && (
                          <div className="text-gray-500">
                            {fill.promptCount} prompt
                            {fill.sensitivePromptCount > 0 && ` (${fill.sensitivePromptCount} sensitive)`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {fieldMixLabel(kinds)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/pdf-forms/${m.id}`}
                          className="rounded bg-yge-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-yge-blue-700"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-8 text-xs text-gray-500">
          The PDF byte rewriting (loading the AcroForm tree, writing values,
          flattening, embedding signatures) lands in the next bundle on top
          of pdf-lib. The library shape + the per-form preview API are in
          place today.
        </p>
      </main>
    </AppShell>
  );
}

function fieldMixLabel(kinds: ReturnType<typeof summarizeFieldKinds>): string {
  const parts: string[] = [];
  if (kinds.text > 0) parts.push(`${kinds.text} text`);
  if (kinds.checkbox > 0) parts.push(`${kinds.checkbox} ✓`);
  if (kinds.radio > 0) parts.push(`${kinds.radio} radio`);
  if (kinds.dropdown > 0) parts.push(`${kinds.dropdown} drop`);
  if (kinds.date > 0) parts.push(`${kinds.date} date`);
  if (kinds.signature > 0) parts.push(`${kinds.signature} sig`);
  return parts.join(' · ');
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warn' | 'danger';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
