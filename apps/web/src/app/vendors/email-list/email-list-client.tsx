'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Entry { id: string; legalName: string; email: string; contactName: string | null }
interface Resp { total: number; kind: string | null; emails: Entry[]; bcc: string }

export function EmailListClient() {
  const [kind, setKind] = useState<string>('');
  const [data, setData] = useState<Resp | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = kind
      ? `${apiBaseUrl()}/api/vendors/email-list?kind=${encodeURIComponent(kind)}`
      : `${apiBaseUrl()}/api/vendors/email-list`;
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, [kind]);

  function copy() {
    if (!data) return;
    navigator.clipboard.writeText(data.bcc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-sm">
          <span className="block text-xs font-semibold text-gray-700">Filter by kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="SUBCONTRACTOR">SUBCONTRACTOR</option>
            <option value="SUPPLIER">SUPPLIER</option>
            <option value="RENTAL">RENTAL</option>
            <option value="LABOR">LABOR</option>
            <option value="SERVICE">SERVICE</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>
      </div>

      {!data ? <p className="text-sm text-gray-500">Loading…</p> : data.total === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">No emails in this kind.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">BCC ({data.total})</span>
              <button type="button" onClick={copy} className="rounded bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea readOnly value={data.bcc} rows={4} className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs" />
          </div>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {data.emails.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2 px-4 py-2 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{e.legalName}</div>
                  {e.contactName && <div className="text-xs text-gray-500">{e.contactName}</div>}
                </div>
                <a href={`mailto:${e.email}`} className="text-xs text-yge-blue-700 hover:underline">{e.email}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
