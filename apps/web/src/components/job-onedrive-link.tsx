// Per-job OneDrive folder link/create button.
//
// On first render, GETs the folder. If 404, shows "Create OneDrive
// folder" button. After create, opens the folder in a new tab and
// caches the webUrl so subsequent visits are a single click.

'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function JobOneDriveLink({
  email,
  jobNumber,
  projectName,
  microsoftConnected,
}: {
  email: string;
  jobNumber: string;
  projectName: string;
  microsoftConnected: boolean;
}) {
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!microsoftConnected) {
      setLoading(false);
      return;
    }
    const q = new URLSearchParams({
      email,
      jobNumber,
      projectName,
    }).toString();
    fetch(`${apiBaseUrl()}/api/microsoft/onedrive/job-folder?${q}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (res.status === 404) {
          setWebUrl(null);
          return;
        }
        if (!res.ok) {
          setError(`Lookup failed (${res.status})`);
          return;
        }
        const body = (await res.json()) as { webUrl?: string };
        setWebUrl(body.webUrl ?? null);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [email, jobNumber, projectName, microsoftConnected]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/microsoft/onedrive/job-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, jobNumber, projectName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Create failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { webUrl?: string };
      setWebUrl(body.webUrl ?? null);
      if (body.webUrl) {
        window.open(body.webUrl, '_blank', 'noopener');
      }
    } finally {
      setCreating(false);
    }
  }

  if (!microsoftConnected) {
    return null;
  }
  if (loading) {
    return (
      <span className="text-xs text-gray-500">Checking OneDrive folder…</span>
    );
  }
  if (error) {
    return (
      <span className="text-xs text-red-700">OneDrive: {error}</span>
    );
  }
  if (webUrl) {
    return (
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-yge-blue-300 bg-yge-blue-50 px-2 py-1 text-xs font-semibold text-yge-blue-800 hover:bg-yge-blue-100"
      >
        📁 OneDrive folder →
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={creating}
      onClick={() => void create()}
      className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
    >
      {creating ? 'Creating folder…' : '📁 Create OneDrive folder'}
    </button>
  );
}
