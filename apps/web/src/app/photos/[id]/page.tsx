// /photos/[id] — photo detail / edit.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Photo } from '@yge/shared';
import { PhotoEditor } from '../../../components/photo-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPhoto(id: string): Promise<Photo | null> {
  const res = await fetch(`${apiBaseUrl()}/api/photos/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { photo: Photo }).photo;
}

export default async function PhotoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const photo = await fetchPhoto(params.id);
  if (!photo) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/photos" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Photo Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{photo.caption}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {photo.takenOn} · {photo.location}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {photo.id}</p>
      <div className="mt-6">
        <PhotoEditor mode="edit" photo={photo} />
      </div>

      <AuditBinderPanel entityType="Photo" entityId={photo.id} />
    </main>
  );
}
