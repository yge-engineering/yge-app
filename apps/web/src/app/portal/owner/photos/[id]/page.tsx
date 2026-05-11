// /portal/owner/photos/[id] — read-only photo detail for owners.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '../../../../../lib/auth';
import { currentUserCan } from '../../../../../lib/permissions';
import {
  photoCategoryLabel,
  type Photo,
  type PortalUser,
} from '@yge/shared';

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

async function fetchPhoto(id: string): Promise<Photo | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/photos/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { photo?: Photo };
    return body.photo ?? null;
  } catch {
    return null;
  }
}

export default async function OwnerPhotoDetailPage({
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

  const photo = await fetchPhoto(params.id);
  if (!photo) notFound();

  const assigned = user.assignedJobIds ?? [];
  if (!assigned.includes(photo.jobId)) {
    // Don't reveal photos for jobs the owner isn't assigned to.
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/portal/owner/jobs/${photo.jobId}`}
            className="text-xs text-yge-blue-700 hover:underline"
          >
            ← Back to project
          </Link>
          <h1 className="mt-1 text-xl font-bold text-yge-blue-900">
            {photo.caption || photo.reference}
          </h1>
          <p className="text-xs text-gray-600">
            {photoCategoryLabel(photo.category)} · {photo.takenOn}
            {photo.takenAt ? ` ${photo.takenAt}` : ''}
            {photo.location ? ` · ${photo.location}` : ''}
            {photo.photographerName ? ` · ${photo.photographerName}` : ''}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          {/* Photo file is referenced by a Storage key or external URL.
              When the reference is an http(s) URL we can render it directly;
              for Storage keys the API would need to mint a signed URL —
              which isn't part of this read-only portal yet. We surface
              the reference + a placeholder either way. */}
          {photo.reference.startsWith('http') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.reference}
              alt={photo.caption || 'Project photo'}
              className="mx-auto max-h-[70vh] rounded border border-gray-200"
            />
          ) : (
            <div className="aspect-video w-full rounded border border-gray-200 bg-gray-100 text-center text-sm text-gray-500">
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <span className="text-2xl">📷</span>
                <span>
                  Photo file is stored in YGE's archive
                  ({photo.reference.slice(0, 30)}…). Ask your YGE PM if
                  you need the full-size original.
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Details
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Date</dt>
              <dd className="font-mono">{photo.takenOn}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Time</dt>
              <dd className="font-mono">{photo.takenAt ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Category</dt>
              <dd>{photoCategoryLabel(photo.category)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Location</dt>
              <dd>{photo.location ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Photographer</dt>
              <dd>{photo.photographerName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">GPS</dt>
              <dd className="font-mono">
                {photo.latitude != null && photo.longitude != null
                  ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`
                  : '—'}
              </dd>
            </div>
            {photo.notes ? (
              <div className="col-span-2">
                <dt className="text-xs text-gray-500">Notes</dt>
                <dd className="whitespace-pre-line">{photo.notes}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </main>
  );
}
