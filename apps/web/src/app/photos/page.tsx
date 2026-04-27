// /photos — field photo log (cross-job).

import Link from 'next/link';
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
  const url = new URL(`${apiBaseUrl()}/api/photos`);
  if (filter.category) url.searchParams.set('category', filter.category);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { photos: Photo[] }).photos;
}
async function fetchAll(): Promise<Photo[]> {
  const res = await fetch(`${apiBaseUrl()}/api/photos`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { photos: Photo[] }).photos;
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
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/photos/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + Log photo
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Photo Log</h1>
      <p className="mt-2 text-gray-700">
        Field photo metadata. Backs delay claims, change orders, SWPPP audits,
        OSHA incident reports, and disputed punch items. Phase 1 stores the
        record; the file lives wherever you point the reference at.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total photos" value={rollup.total} />
        <Stat label="Last logged" value={rollup.lastTakenOn ?? '—'} />
        <Stat
          label="Missing GPS"
          value={rollup.missingGps}
          variant={rollup.missingGps > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Top category"
          value={rollup.byCategory[0] ? photoCategoryLabel(rollup.byCategory[0].category) : '—'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Category:</span>
        <Link
          href={buildHref({ category: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.category ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref({ category: c })}
            className={`rounded px-2 py-1 text-xs ${searchParams.category === c ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {photoCategoryLabel(c)}
          </Link>
        ))}
      </section>

      {photos.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No photos in this filter. Click <em>Log photo</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Caption</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">GPS</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {photos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {p.takenOn}
                    {p.takenAt && <div className="text-[10px] text-gray-500">{p.takenAt}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.jobId}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{p.location}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="line-clamp-2">{p.caption}</div>
                    {p.photographerName && (
                      <div className="text-[10px] text-gray-500">by {p.photographerName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700">
                      {photoCategoryLabel(p.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-gray-700">
                    <div className="max-w-xs truncate">{p.reference}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.latitude != null && p.longitude != null ? (
                      <span className="text-green-700">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link href={`/photos/${p.id}`} className="text-yge-blue-500 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
