// Photo upload widget — sits next to the reference input on the
// photo editor and pushes the bytes to Supabase Storage via
// POST /api/photos/upload.

'use client';

import { useRef, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface PhotoUploadWidgetProps {
  /** Called with the storage object key once the upload finishes. */
  onUploaded: (reference: string, signedUrl: string) => void;
  /** Optional currently-set signed URL to render as a thumbnail. */
  initialPreview?: string;
}

export function PhotoUploadWidget({
  onUploaded,
  initialPreview,
}: PhotoUploadWidgetProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(
    initialPreview ?? null,
  );

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${apiBaseUrl()}/api/photos/upload`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        reference: string;
        signedUrl: string;
      };
      setPreview(body.signedUrl);
      onUploaded(body.reference, body.signedUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mt-2 rounded-md border border-yge-blue-200 bg-yge-blue-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="text-yge-blue-900">Upload photo:</strong>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/jpg"
          capture="environment"
          onChange={onChange}
          disabled={busy}
          className="text-xs"
        />
        {busy ? (
          <span className="text-xs text-gray-700">Uploading…</span>
        ) : null}
        <span className="text-xs text-gray-600">
          Pick from gallery or take a fresh shot — we upload to Supabase
          Storage and fill the reference field below.
        </span>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {preview ? (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Uploaded photo preview"
            className="max-h-48 rounded border border-gray-200"
          />
        </div>
      ) : null}
    </div>
  );
}
