'use client';

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  rfiDaysOutstanding,
  rfiPriorityLabel,
  rfiStatusLabel,
  type Job,
  type Rfi,
  type RfiPriority,
  type RfiStatus,
} from '@yge/shared';

const STATUSES: RfiStatus[] = ['DRAFT', 'SENT', 'ANSWERED', 'CLOSED', 'WITHDRAWN'];
const PRIORITIES: RfiPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface Props {
  initial: Rfi;
  jobs: Job[];
  apiBaseUrl: string;
}

export function RfiEditor({ initial, jobs, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [r, setR] = useState<Rfi>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState(r.subject);
  const [question, setQuestion] = useState(r.question);
  const [askedOf, setAskedOf] = useState(r.askedOf ?? '');
  const [reference, setReference] = useState(r.referenceCitation ?? '');
  const [sentAt, setSentAt] = useState(r.sentAt ?? '');
  const [responseDueAt, setResponseDueAt] = useState(r.responseDueAt ?? '');
  const [answeredAt, setAnsweredAt] = useState(r.answeredAt ?? '');
  const [answer, setAnswer] = useState(r.answer ?? '');
  const [rfiPdfUrl, setRfiPdfUrl] = useState(r.rfiPdfUrl ?? '');
  const [answerPdfUrl, setAnswerPdfUrl] = useState(r.answerPdfUrl ?? '');
  const [notes, setNotes] = useState(r.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/rfis/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('rfiEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { rfi: Rfi };
      setR(json.rfi);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rfiEditor.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    void patch({
      subject: subject.trim() || r.subject,
      question: question,
      askedOf: askedOf.trim() || undefined,
      referenceCitation: reference.trim() || undefined,
      sentAt: sentAt.trim() || undefined,
      responseDueAt: responseDueAt.trim() || undefined,
      answeredAt: answeredAt.trim() || undefined,
      answer: answer.trim() || undefined,
      rfiPdfUrl: rfiPdfUrl.trim() || undefined,
      answerPdfUrl: answerPdfUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const days = rfiDaysOutstanding(r);
  const job = jobs.find((j) => j.id === r.jobId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wide text-gray-500">
            {t('rfiEditor.heading', { number: r.rfiNumber })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{r.subject}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : r.jobId}
            {days !== undefined && (
              <>
                {' '}{days === 1 ? t('rfiEditor.outstandingOne') : t('rfiEditor.outstandingMany', { days })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={r.priority}
            onChange={(e) => void patch({ priority: e.target.value as RfiPriority })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {rfiPriorityLabel(p)}
              </option>
            ))}
          </select>
          <select
            value={r.status}
            onChange={(e) => void patch({ status: e.target.value as RfiStatus })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {rfiStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('rfiEditor.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('rfiEditor.lblSubject')}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblAskedOf')}>
          <input
            value={askedOf}
            onChange={(e) => setAskedOf(e.target.value)}
            onBlur={saveAll}
            placeholder={t('rfiEditor.phAskedOf')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblReference')}>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onBlur={saveAll}
            placeholder={t('rfiEditor.phReference')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblSent')}>
          <input
            type="date"
            value={sentAt}
            onChange={(e) => setSentAt(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblResponseDue')}>
          <input
            type="date"
            value={responseDueAt}
            onChange={(e) => setResponseDueAt(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblAnswered')}>
          <input
            type="date"
            value={answeredAt}
            onChange={(e) => setAnsweredAt(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label={t('rfiEditor.lblQuestion')}>
        <textarea
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label={t('rfiEditor.lblAnswer')}>
        <textarea
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('rfiEditor.lblRfiPdf')}>
          <input
            value={rfiPdfUrl}
            onChange={(e) => setRfiPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('rfiEditor.lblAnswerPdf')}>
          <input
            value={answerPdfUrl}
            onChange={(e) => setAnswerPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <section className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.costImpact}
            onChange={(e) => void patch({ costImpact: e.target.checked })}
            className="h-4 w-4"
          />
          {t('rfiEditor.costImpact')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={r.scheduleImpact}
            onChange={(e) => void patch({ scheduleImpact: e.target.checked })}
            className="h-4 w-4"
          />
          {t('rfiEditor.scheduleImpact')}
        </label>
      </section>

      <Field label={t('rfiEditor.lblNotes')}>
        <textarea
          rows={3}
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
