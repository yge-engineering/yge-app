// /photos/new — log a new photo entry.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PhotoEditor } from '../../../components/photo-editor';

export default function NewPhotoPage() {
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/photos" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Photo Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Log photo</h1>
      <p className="mt-2 text-gray-700">
        Record metadata for a field photo. Drop the file in your photo
        archive (drive, S3, etc.) and paste the path or URL into reference.
      </p>
      <div className="mt-6">
        <PhotoEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
