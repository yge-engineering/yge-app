// Inline photo upload + recent-uploads list for the daily-report
// editor. POSTs to /api/photos/upload (Supabase Storage push) and
// then to /api/photos (metadata) so each upload becomes a saved
// Photo record linked to this DR.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Photo } from '@yge/shared';

interface UploadResult {
  reference: string;
  signedUrl: string;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function uploadFile(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${apiBaseUrl()}/api/photos/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadResult;
}

async function createPhoto(input: {
  jobId: string;
  dailyReportId: string;
  reference: string;
  photographerName: string;
  takenOn: string;
}): Promise<Photo> {
  const body = {
    ...input,
    location: 'Jobsite',
    caption: 'Daily report photo',
    category: 'PROGRESS' as const,
  };
  const res = await fetch(`${apiBaseUrl()}/api/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `Create failed (${res.status})`);
  }
  const out = (await res.json()) as { photo: Photo };
  return out.photo;
}

async function fetchExistingPhotos(jobId: string): Promise<Photo[]> {
  const res = await fetch(
    `${apiBaseUrl()}/api/photos?jobId=${encodeURIComponent(jobId)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { photos: Photo[] };
  return body.photos;
}

interface UploadedRow {
  photoId: string;
  signedUrl: string;
}

export function DailyReportPhotoPanel({
  reportId,
  jobId,
  reportDate,
  photographerName,
}: {
  reportId: string;
  jobId: string;
  reportDate: string;
  photographerName: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedRow[]>([]);
  const [existing, setExisting] = useState<Photo[]>([]);

  // Load any photos already linked to this DR.
  useEffect(() => {
    let cancelled = false;
    fetchExistingPhotos(jobId)
      .then((all) => {
        if (cancelled) return;
        setExisting(all.filter((p) => p.dailyReportId === reportId));
      })
      .catch(() => {
        // Swallow — the upload flow still works without the gallery.
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, reportId]);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of files) {
        const up = await uploadFile(file);
        const photo = await createPhoto({
          jobId,
          dailyReportId: reportId,
          reference: up.reference,
          photographerName,
          takenOn: reportDate,
        });
        setUploads((prev) => [
          ...prev,
          { photoId: photo.id, signedUrl: up.signedUrl },
        ]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const totalCount = existing.length + uploads.length;

  return (
    <section className="rounded-md border border-yge-blue-200 bg-yge-blue-50 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <strong className="text-sm text-yge-blue-900">📷 Photos</strong>
        <span className="text-xs text-gray-600">
          {totalCount} attached so far. Upload here for a quick capture;
          full metadata edits live at /photos.
        </span>
      </header>
      <div className="mt-2 flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/jpg"
          capture="environment"
          multiple
          onChange={onChange}
          disabled={busy}
          className="text-xs"
        />
        {busy ? (
          <span className="text-xs text-gray-700">Uploading…</span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
      {(existing.length > 0 || uploads.length > 0) ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {existing.map((p) => (
            <a
              key={p.id}
              href={`/photos/${p.id}`}
              className="block overflow-hidden rounded border border-gray-200 bg-white"
              title={p.caption}
            >
              <div className="aspect-square bg-gray-100 text-center text-[10px] uppercase tracking-wide text-gray-500 flex items-center justify-center">
                {p.category}
              </div>
              <div className="px-2 py-1 text-[11px] text-gray-700 truncate">
                {p.caption || p.reference}
              </div>
            </a>
          ))}
          {uploads.map((u) => (
            <a
              key={u.photoId}
              href={`/photos/${u.photoId}`}
              className="block overflow-hidden rounded border border-green-300 bg-white"
              title="Just uploaded"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.signedUrl}
                alt="Newly uploaded"
                className="h-32 w-full object-cover"
              />
              <div className="px-2 py-1 text-[11px] text-green-800">Saved ✓</div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
