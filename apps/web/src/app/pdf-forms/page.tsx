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
import { PrintButton } from '../../components/print-button';
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/master-profile" className="text-yge-blue-500 hover:underline">
              &larr; Master profile
            </Link>
            <Link href="/extension" className="text-yge-blue-500 hover:underline">
              Browser extension →
            </Link>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 print:hidden">
            <span>
              {mappings.length} form{mappings.length === 1 ? '' : 's'} loaded
            </span>
            <a
              href={`${apiBaseUrl()}/api/pdf-form-mappings/export.csv`}
              className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
            >
              Export catalog as CSV
            </a>
            <PrintButton label="Print catalog" />
          </div>
        </div>

        <PageHeader
          title={t('pdfForms.title')}
          subtitle={t('pdfForms.subtitle')}
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label={t('pdfForms.tile.total')} value={String(rollup.total)} />
          <Tile label={t('pdfForms.tile.reviewed')} value={String(rollup.reviewedCount)} tone="success" />
          <Tile label={t('pdfForms.tile.drafts')} value={String(rollup.draftCount)} tone="warn" />
        </section>

        {/* Filter chips. When draftCount > 0 the "Show review queue"
         *  chip jumps to ?reviewed=false so Ryan or the office can
         *  burn down the unreviewed list one form at a time without
         *  scrolling past the already-reviewed ones. */}
        {rollup.total > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Filter:</span>
            <Link
              href="/pdf-forms"
              className={`rounded border px-2 py-1 font-medium ${
                !searchParams.reviewed
                  ? 'border-yge-blue-500 bg-yge-blue-500 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              All ({rollup.total})
            </Link>
            <Link
              href="/pdf-forms?reviewed=true"
              className={`rounded border px-2 py-1 font-medium ${
                searchParams.reviewed === 'true'
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              ✓ Reviewed ({rollup.reviewedCount})
            </Link>
            <Link
              href="/pdf-forms?reviewed=false"
              className={`rounded border px-2 py-1 font-medium ${
                searchParams.reviewed === 'false'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : rollup.draftCount > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              ⚠ Review queue ({rollup.draftCount})
            </Link>
          </div>
        )}

        {/* Agency-type filter pills. Shows one chip per agency
         *  enum value that has at least one form seeded. Builds
         *  the URL preserving any existing reviewed= filter. */}
        {rollup.byAgency.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Agency:</span>
            {[{ agency: 'ALL' as const, count: rollup.total }, ...rollup.byAgency].map(
              (entry) => {
                const isAll = entry.agency === 'ALL';
                const isActive = isAll
                  ? !searchParams.agency
                  : searchParams.agency === entry.agency;
                const params = new URLSearchParams();
                if (!isAll) params.set('agency', String(entry.agency));
                if (searchParams.reviewed) params.set('reviewed', searchParams.reviewed);
                const href = params.toString()
                  ? `/pdf-forms?${params.toString()}`
                  : '/pdf-forms';
                return (
                  <Link
                    key={String(entry.agency)}
                    href={href}
                    className={`rounded border px-2 py-1 font-medium ${
                      isActive
                        ? 'border-yge-blue-500 bg-yge-blue-500 text-white'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isAll ? 'All agencies' : String(entry.agency).replace(/_/g, ' ')} ({entry.count})
                  </Link>
                );
              },
            )}
          </div>
        )}

        {mappings.length === 0 ? (
          <Alert tone="info" className="mt-6">
            {t('pdfForms.empty')}
          </Alert>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('pdfForms.col.form')}</th>
                  <th className="px-3 py-2 text-left">{t('pdfForms.col.agency')}</th>
                  <th className="px-3 py-2 text-left">{t('pdfForms.col.status')}</th>
                  <th className="px-3 py-2 text-right">{t('pdfForms.col.fillability')}</th>
                  <th className="px-3 py-2 text-left">{t('pdfForms.col.fieldMix')}</th>
                  <th className="px-3 py-2 text-right">{t('pdfForms.col.action')}</th>
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
                          {fill.autoFillCount} / {fill.total} {t('pdfForms.fillability.auto')}
                        </div>
                        {fill.promptCount > 0 && (
                          <div className="text-gray-500">
                            {fill.promptCount} {t('pdfForms.fillability.prompt')}
                            {fill.sensitivePromptCount > 0 && ` (${fill.sensitivePromptCount} ${t('pdfForms.fillability.sensitive')})`}
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
                          {t('pdfForms.action.open')}
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
