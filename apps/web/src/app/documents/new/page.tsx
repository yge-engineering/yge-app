'use client';

// /documents/new — minimal create form. Pick the kind, label it, paste
// the URL, optional job + tags. After save, jump to edit page.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  documentKindLabel,
  type Document,
  type DocumentKind,
  type Job,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

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

export default function NewDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DocumentKind>('RFP');
  const [jobId, setJobId] = useState('');
  const [url, setUrl] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => setJobs(j.jobs ?? []))
      .catch(() => setJobs([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0) {
      setError('Title is required.');
      return;
    }
    const tags = tagsRaw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSaving(true);
    try {
      const res = await postJson<{ document: Document }>('/api/documents', {
        title: title.trim(),
        kind,
        ...(jobId ? { jobId } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        ...(documentDate.trim() ? { documentDate: documentDate.trim() } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      });
      router.push(`/documents/${res.document.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/documents" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to documents
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Add document</h1>
      <p className="mt-2 text-gray-700">
        Capture a pointer to a PDF / file plus enough metadata to find it
        later. The actual file lives wherever you keep it (Drive, SharePoint,
        Bluebeam, local path) — paste that URL or path below.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Title *">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Sulphur Springs RFP rev B"'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {documentKindLabel(k)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job (optional)">
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
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
        </div>
        <Field label="URL or path">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://drive.google.com/... or "S:/YGE/2026/..."'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Document date">
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Tags (comma or space separated)">
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="caltrans drainage rev-b"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save document'}
          </button>
          <Link href="/documents" className="text-sm text-gray-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
    </AppShell>
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
