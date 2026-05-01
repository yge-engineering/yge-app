// /documents — metadata-only document vault.
//
// Filterable by kind + job + tag via URL query params so the foreman
// can deep-link "show me every addendum on Sulphur Springs".

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  documentKindLabel,
  type Document,
  type DocumentKind,
  type Job,
} from '@yge/shared';

const ALL_KINDS: DocumentKind[] = [
  'RFP',
  'PLAN_SET',
  'SPEC',
  'ADDENDUM',
  'BID_FORM_BLANK',
  'BID_FORM_SIGNED',
  'COVER_LETTER',
  'BID_BOND',
  'CSLB_CERT',
  'DIR_CERT',
  'INSURANCE_CERT',
  'BUSINESS_LICENSE',
  'SITE_PHOTO',
  'CORRESPONDENCE',
  'CONTRACT',
  'CHANGE_ORDER',
  'INVOICE',
  'OTHER',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDocuments(filter: {
  jobId?: string;
  kind?: string;
  tag?: string;
}): Promise<Document[]> {
  const url = new URL(`${apiBaseUrl()}/api/documents`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  if (filter.kind) url.searchParams.set('kind', filter.kind);
  if (filter.tag) url.searchParams.set('tag', filter.tag);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { documents: Document[] }).documents;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { jobId?: string; kind?: string; tag?: string };
}) {
  const [docs, jobs] = await Promise.all([
    fetchDocuments(searchParams),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const activeJob = searchParams.jobId ? jobById.get(searchParams.jobId) : undefined;

  // Collect unique tags for the filter chip strip.
  const tagSet = new Set<string>();
  docs.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
  const allTags = Array.from(tagSet).sort();

  function buildHref(overrides: Partial<{ jobId?: string; kind?: string; tag?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.kind) params.set('kind', merged.kind);
    if (merged.tag) params.set('tag', merged.tag);
    const q = params.toString();
    return q ? `/documents?${q}` : '/documents';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/documents/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Add document
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Document vault</h1>
      <p className="mt-2 text-gray-700">
        Phase 1 metadata-only store. Captures the URL or path to a PDF + the
        kind + tags so it&rsquo;s findable later. File upload + AI summarization
        land in a later phase.
      </p>

      {/* Filters */}
      <section className="mt-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Job:</span>
          <Link
            href={buildHref({ jobId: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.jobId ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {jobs.slice(0, 6).map((j) => (
            <Link
              key={j.id}
              href={buildHref({ jobId: j.id })}
              className={`rounded px-2 py-1 text-xs ${searchParams.jobId === j.id ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {j.projectName}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Kind:</span>
          <Link
            href={buildHref({ kind: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.kind ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {ALL_KINDS.map((k) => (
            <Link
              key={k}
              href={buildHref({ kind: k })}
              className={`rounded px-2 py-1 text-xs ${searchParams.kind === k ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {documentKindLabel(k)}
            </Link>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-gray-500">Tag:</span>
            <Link
              href={buildHref({ tag: undefined })}
              className={`rounded px-2 py-1 text-xs ${!searchParams.tag ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              All
            </Link>
            {allTags.map((t) => (
              <Link
                key={t}
                href={buildHref({ tag: t })}
                className={`rounded px-2 py-1 text-xs ${searchParams.tag === t ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
      </section>

      {activeJob && (
        <p className="mt-4 text-sm text-gray-600">
          Filtered to <strong>{activeJob.projectName}</strong>
          {searchParams.kind && (
            <>
              {' '}\u00b7 {documentKindLabel(searchParams.kind as DocumentKind)}
            </>
          )}
          {searchParams.tag && <> \u00b7 #{searchParams.tag}</>}
        </p>
      )}

      {docs.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No documents match. Try adjusting the filters or click <em>Add document</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Tags</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((d) => {
                const job = d.jobId ? jobById.get(d.jobId) : undefined;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.title}</div>
                      {d.pageCount !== undefined && (
                        <div className="text-xs text-gray-500">
                          {d.pageCount} page{d.pageCount === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
                      {documentKindLabel(d.kind)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {d.documentDate ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {d.tags.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        d.tags.map((t) => (
                          <span
                            key={t}
                            className="mr-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px]"
                          >
                            #{t}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mr-3 text-yge-blue-500 hover:underline"
                        >
                          Open
                        </a>
                      )}
                      <Link
                        href={`/documents/${d.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
  );
}
