// /portal/owner/jobs/[id]/photos — full photo gallery for one job.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '../../../../../../lib/auth';
import { currentUserCan } from '../../../../../../lib/permissions';
import { photoCategoryLabel, type Photo, type PortalUser } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPortalUser(email: string): Promise<PortalUser | null> {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: PortalUser };
    return body.user ?? null;
  } catch {
    return null;
  }
}

async function fetchPhotos(jobId: string): Promise<Photo[]> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/photos?jobId=${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return ((await res.json()) as { photos: Photo[] }).photos;
  } catch {
    return [];
  }
}

export default async function OwnerPhotosPage({
  params,
}: {
  params: { id: string };
}) {
  if (!currentUserCan('portal:owner')) {
    redirect('/login');
  }
  const me = getCurrentUser();
  const user = await fetchPortalUser(me?.email ?? '');
  if (!user) redirect('/portal/owner');
  const assigned = user.assignedJobIds ?? [];
  if (!assigned.includes(params.id)) notFound();

  const photos = (await fetchPhotos(params.id)).sort((a, b) =>
    b.takenOn.localeCompare(a.takenOn),
  );

  // Group by month for visual structure.
  const byMonth = new Map<string, Photo[]>();
  for (const p of photos) {
    const ym = p.takenOn.slice(0, 7);
    const list = byMonth.get(ym) ?? [];
    list.push(p);
    byMonth.set(ym, list);
  }
  const months = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/portal/owner/jobs/${params.id}`}
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            All photos ({photos.length})
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {photos.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No photos on this project yet.
          </p>
        ) : (
          months.map((ym) => (
            <section key={ym}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {ym} · {byMonth.get(ym)!.length} photo
                {byMonth.get(ym)!.length === 1 ? '' : 's'}
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {byMonth.get(ym)!.map((p) => (
                  <a
                    key={p.id}
                    href={`/portal/owner/photos/${p.id}`}
                    className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100 text-center text-[10px] text-gray-600 hover:border-yge-blue-500"
                  >
                    <div className="px-1 py-2 font-semibold uppercase tracking-wide text-gray-500">
                      {photoCategoryLabel(p.category)}
                    </div>
                    <div className="px-1 text-[10px]">
                      {p.takenOn}
                      {p.caption ? ` · ${p.caption.slice(0, 40)}` : ''}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
