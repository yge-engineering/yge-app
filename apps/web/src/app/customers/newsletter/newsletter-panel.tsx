'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function NewsletterPanel() {
  const [bcc, setBcc] = useState<string>('');
  const [total, setTotal] = useState<number>(0);
  const [subject, setSubject] = useState('YGE update');
  const [body, setBody] = useState(
    `Hi,\n\nQuick note to keep in touch. Let me know if there's anything coming up your way we might be a good fit on.\n\nThanks,\nRyan Young\nYoung General Engineering, Inc.\n707-599-9921`,
  );

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/customers/email-list`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { total?: number; bcc?: string } | null) => {
        if (j) {
          setBcc(j.bcc ?? '');
          setTotal(j.total ?? 0);
        }
      });
  }, []);

  const mailto = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs text-gray-500">Will BCC {total} customer{total === 1 ? '' : 's'}.</div>
      </div>
      <label className="block">
        <span className="block text-xs font-semibold text-gray-700">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-gray-700">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
        />
      </label>
      <a
        href={mailto}
        className="inline-block rounded bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
      >
        Open in Mail
      </a>
    </div>
  );
}
