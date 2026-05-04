// Inline-prompt form for /pdf-forms/[id].
//
// Client island. Each prompt-source field on a form mapping
// becomes one input row here. POSTs to /api/pdf-form-mappings/:id/
// preview with the answers; backend responds with the updated
// FillReport. The reload semantics are simple — a router.refresh()
// re-renders the server-side preview table with the new answers
// stashed in URL search params (Phase-1 stand-in for a more
// elegant client-side state).
//
// The 'Download filled PDF' button gates here on every required
// prompt being answered. POSTs /api/pdf-form-mappings/:id/fill
// and saves the response Blob via a temporary anchor.

'use client';

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';

interface PromptField {
  fieldId: string;
  label: string;
  hint?: string;
  sensitive: boolean;
  required: boolean;
}

interface Props {
  apiBaseUrl: string;
  mappingId: string;
  promptFields: PromptField[];
}

interface PreviewResponse {
  report: {
    total: number;
    filledCount: number;
    awaitingPromptCount: number;
    requiredEmpty: Array<{ fieldId: string; pdfFieldName: string }>;
  };
}

export function PdfFormPromptForm({ apiBaseUrl, mappingId, promptFields }: Props) {
  const t = useTranslator();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse['report'] | null>(null);

  const requiredPrompts = promptFields.filter((f) => f.required);
  const requiredAnswered = requiredPrompts.every(
    (f) => (answers[f.fieldId] ?? '').trim().length > 0,
  );

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/pdf-form-mappings/${mappingId}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptAnswers: answers }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('pdfPrompt.errApi', { status: res.status }));
        return;
      }
      const json = (await res.json()) as PreviewResponse;
      setPreview(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadFilled() {
    if (busy || !requiredAnswered) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/pdf-form-mappings/${mappingId}/fill`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptAnswers: answers }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t('pdfPrompt.errFill', { status: res.status }));
        return;
      }
      const warnCount = Number(res.headers.get('x-pdf-warning-count') ?? '0');
      if (warnCount > 0) {
        // eslint-disable-next-line no-console
        console.warn(`PDF fill produced ${warnCount} per-field warning(s) — check the API logs.`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mappingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {t('pdfPrompt.title', { count: promptFields.length })}
      </h2>
      <div className="space-y-3">
        {promptFields.map((f) => (
          <label key={f.fieldId} className="block text-sm">
            <span className="mb-1 flex items-center gap-2">
              <span className="font-medium text-gray-700">{f.label}</span>
              {f.required && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-red-800">
                  {t('pdfPrompt.required')}
                </span>
              )}
              {f.sensitive && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                  {t('pdfPrompt.sensitive')}
                </span>
              )}
            </span>
            <input
              type={f.sensitive ? 'password' : 'text'}
              autoComplete="off"
              value={answers[f.fieldId] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [f.fieldId]: e.target.value }))}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
            />
            {f.hint && <span className="mt-1 block text-xs text-gray-500">{f.hint}</span>}
          </label>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900">
          {t('pdfPrompt.preview', { filled: preview.filledCount, total: preview.total, awaiting: preview.awaitingPromptCount, required: preview.requiredEmpty.length })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={runPreview}
          disabled={busy}
          className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50 disabled:opacity-50"
        >
          {busy ? t('pdfPrompt.busyPreview') : t('pdfPrompt.recompute')}
        </button>
        <button
          type="button"
          onClick={downloadFilled}
          disabled={busy || !requiredAnswered}
          title={requiredAnswered ? t('pdfPrompt.tipReady') : t('pdfPrompt.tipBlocked')}
          className="rounded bg-yge-blue-500 px-4 py-1 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('pdfPrompt.busyFill') : t('pdfPrompt.download')}
        </button>
        <span className="text-xs text-gray-500">
          {(() => {
            if (requiredAnswered) return t('pdfPrompt.allReady');
            const blanks = requiredPrompts.filter((f) => !(answers[f.fieldId] ?? '').trim()).length;
            return blanks === 1 ? t('pdfPrompt.blankOne') : t('pdfPrompt.blankMany', { count: blanks });
          })()}
        </span>
      </div>
    </section>
  );
}
