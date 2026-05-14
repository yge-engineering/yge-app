'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface HealthResp { ok?: boolean; uptimeSeconds?: number; checks?: Record<string, unknown> }

export function HealthCheckPanel() {
  const [data, setData] = useState<HealthResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/admin/health`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: HealthResp) => setData(j))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load health endpoint: {error}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-3 shadow-sm ${data.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="text-sm font-semibold">{data.ok ? 'OK' : 'Not OK'}</div>
        {typeof data.uptimeSeconds === 'number' ? (
          <div className="text-xs text-gray-700">Uptime: {(data.uptimeSeconds / 60).toFixed(1)} minutes</div>
        ) : null}
      </div>

      <details className="rounded border border-gray-200 bg-white p-3 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900">Raw response</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}
