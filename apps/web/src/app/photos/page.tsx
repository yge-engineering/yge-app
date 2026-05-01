// /photos — field photo log (cross-job).
//
// Plain English: field photo metadata. Backs delay claims, change
// orders, SWPPP audits, OSHA incident reports, and disputed punch
// items. Phase 1 stores the record; the file lives wherever you
// point the reference at.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  computePhotoRollup,
  photoCategoryLabel,
  type Photo,
  type PhotoCategory,
} from '@yge/shared';

const CATEGORIES: PhotoCategory[] = [
  'PROGRESS',
  'PRE_CONSTRUCTION',
  'DELAY',
  'CHANGE_ORDER',
  'SWPPP',
  'INCIDENT',
  'PUNCH',
  'COMPLETION',
  'OTHER',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPhotos(filter: { category?: string; jobId?: string }): Promise<Photo[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/photos`);
    if (filter.category) url.searchParams.set('category', filter.category);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { photos: Photo[] }).photos;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<Photo[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/photos`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { photos: Photo[] }).photos;
  } catch {
    return [];
  }
}

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: { category?: string; jobId?: string };
}) {
  const [photos, all] = await Promise.all([fetchPhotos(searchParams), fetchAll()]);
  const rollup = computePhotoRollup(all);

  function buildHref(overrides: Partial<{ category?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.category) params.set('category', merged.category);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/photos?${q}` : '/photos';
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Photo log"
          subtitle="Field photo metadata. Backs delay claims, change orders, SWPPP audits, OSHA incident reports, and disputed punch items."
          actions={
            <LinkButton href="/photos/new" variant="primary" size="md">
              + Log photo
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total photos" value={rollup.total} />
          <Tile label="Last logged" value={rollup.lastTakenOn ?? '—'} />
          <Tile
            label="Missing GPS"
            value={rollup.missingGps}
            tone={rollup.missingGps > 0 ? 'warn' : 'success'}
            warnText={rollup.missingGps > 0 ? 'Geo-tag is the audit win' : undefined}
          />
          <Tile
            label="Top category"
            value={rollup.byCategory[0] ? photoCategoryLabel(rollup.byCategory[0].category) : '—'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Category:</span>
          <Link
            href={buildHref({ category: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.category ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={buildHref({ category: c })}
              className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {photoCategoryLabel(c)}
            </Link>
          ))}
        </section>

        {photos.length === 0 ? (
          <EmptyState
            title="No photos in this filter"
            body="Phone-camera photos with location stamps + captions are gold for delay claims. Log them as soon as the crew takes them."
            actions={[{ href: '/photos/new', label: 'Log photo', primary: true }]}
          />
        ) : (
          <DataTable
            rows={photos}
            keyFn={(p) => p.id}
            columns={[
              {
                key: 'date',
                header: 'Date',
                cell: (p) => (
                  <Link href={`/photos/${p.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {p.takenOn}
                    {p.takenAt ? <div className="text-[10px] font-normal text-gray-500">{p.takenAt}</div> : null}
                  </Link>
                ),
              },
              {
                key: 'job',
                header: 'Job',
                cell: (p) => (
                  <Link href={`/jobs/${p.jobId}`} className="font-mono text-xs text-blue-700 hover:underline">
                    {p.jobId}
                  </Link>
                ),
              },
              { key: 'location', header: 'Location', cell: (p) => <span className="text-xs text-gray-700">{p.location}</span> },
              {
                key: 'caption',
                header: 'Caption',
                cell: (p) => (
                  <div className="text-sm text-gray-900">
                    <div className="line-clamp-2">{p.caption}</div>
                    {p.photographerName ? <div className="text-[10px] text-gray-500">by {p.photographerName}</div> : null}
                  </div>
                ),
              },
              { key: 'category', header: 'Category', cell: (p) => <StatusPill label={photoCategoryLabel(p.category)} tone="neutral" /> },
              {
                key: 'reference',
                header: 'Reference',
                cell: (p) => (
                  <div className="max-w-xs truncate font-mono text-[10px] text-gray-700">{p.reference}</div>
                ),
              },
              {
                key: 'gps',
                header: 'GPS',
                cell: (p) =>
                  p.latitude != null && p.longitude != null ? (
                    <span className="text-xs text-emerald-700">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
