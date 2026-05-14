'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface VersionResp { sha: string; node: string; deployedAt: string | null; at: string }

export function SessionSummaryTile() {
  const [v, setV] = useState<VersionResp | null>(null);
  useEffect(() => {
    fetch(`${apiBaseUrl()}/health/version`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: VersionResp | null) => setV(j));
  }, []);
  if (!v) return null;
  return (
    <section className="rounded-lg border border-yge-blue-300 bg-yge-blue-50 p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-yge-blue-700">
        Deployed build
      </div>
      <div className="text-sm font-mono text-yge-blue-900">{v.sha.slice(0, 8)}</div>
      <div className="text-[10px] text-yge-blue-700 mt-1">{v.node}</div>
    </section>
  );
}
