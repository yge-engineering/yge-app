'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Entry { name: string; email: string; contactName: string | null }
interface Resp { total: number; emails: Entry[]; bcc: string }

export function EmailListClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers/email-list`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No customer emails on file. Add contact emails to customers to populate this list.
      </p>
    );
  }

  function copy() {
    navigator.clipboard.writeText(data!.bcc).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            BCC string ({data.total} email{data.total === 1 ? '' : 's'})
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded bg-yge-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        <textarea
          readOnly
          value={data.bcc}
          rows={4}
          className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs"
        />
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
        {data.emails.map((e) => (
          <li key={e.email} className="flex items-baseline justify-between gap-2 px-4 py-2 text-sm">
            <div>
              <div className="font-medium text-gray-900">{e.name}</div>
              {e.contactName && <div className="text-xs text-gray-500">{e.contactName}</div>}
            </div>
            <a href={`mailto:${e.email}`} className="text-xs text-yge-blue-700 hover:underline">
              {e.email}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
