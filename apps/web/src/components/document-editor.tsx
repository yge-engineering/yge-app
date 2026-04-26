'use client';

import { useState } from 'react';
import {
  documentKindLabel,
  type Document,
  type DocumentKind,
  type Job,
} from '@yge/shared';

const KINDS: DocumentKind[] = [
  'RFP',
  'PLAN_SET',
  'SPEC',
  'ADDENDUM',
  'BID_FORM_BLANK',
  'BID_FORM_SIGNED',
  'COVER_LETTER',
  'BID_BOND',
  'CSLB_CERT',
  'DIR_CERT',
  'INSURANCE_CERT',
  'BUSINESS_LICENSE',
  'SITE_PHOTO',
  'CORRESPONDENCE',
  'CONTRACT',
  'CHANGE_ORDER',
  'INVOICE',
  'OTHER',
];

interface Props {
  initial: Document;
  jobs: Job[];
  apiBaseUrl: string;
}

export function DocumentEditor({ initial, jobs, apiBaseUrl }: Props) {
  const [d, setD] = useState<Document>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(d.title);
  const [url, setUrl] = useState(d.url ?? '');
  const [pageCount, setPageCount] = useState(d.pageCount?.toString() ?? '');
  const [documentDate, setDocumentDate] = useState(d.documentDate ?? '');
  const [tagsRaw, setTagsRaw] = useState(d.tags.join(' '));
  const [notes, setNotes] = useState(d.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/documents/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { document: Document };
      setD(json.document);
      // Sync local mirrors that the server may have normalized (tags).
      setTagsRaw(json.document.tags.join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    const tags = tagsRaw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    void patch({
      title: title.trim() || d.title,
      url: url.trim() || undefined,
      pageCount: pageCount.trim() ? Number(pageCount) : undefined,
      documentDate: documentDate.trim() || undefined,
      tags,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {documentKindLabel(d.kind)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{d.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {d.url && (
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-yge-blue-500 px-3 py-1 font-medium text-white hover:bg-yge-blue-700"
            >
              Open file
            </a>
          )}
          {saving && <span className="text-gray-500">Saving&hellip;</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Kind">
          <select
            value={d.kind}
            onChange={(e) => void patch({ kind: e.target.value as DocumentKind })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {documentKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job">
          <select
            value={d.jobId ?? ''}
            onChange={(e) => void patch({ jobId: e.target.value || undefined })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— Not job-specific —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Document date">
          <input
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="URL / path">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Page count">
          <input
            type="number"
            min="0"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label="Tags (comma or space separated)">
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          onBlur={saveAll}
          placeholder="caltrans drainage rev-b"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
