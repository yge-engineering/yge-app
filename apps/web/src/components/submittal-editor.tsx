'use client';

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  submittalDaysOutstanding,
  submittalKindLabel,
  submittalStatusLabel,
  type Job,
  type Submittal,
  type SubmittalKind,
  type SubmittalStatus,
} from '@yge/shared';

const STATUSES: SubmittalStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REVISE_RESUBMIT',
  'REJECTED',
  'WITHDRAWN',
];

const KINDS: SubmittalKind[] = [
  'SHOP_DRAWING',
  'PRODUCT_DATA',
  'SAMPLE',
  'CERTIFICATE',
  'METHOD_STATEMENT',
  'MIX_DESIGN',
  'OPERATIONS_MANUAL',
  'WARRANTY',
  'OTHER',
];

interface Props {
  initial: Submittal;
  jobs: Job[];
  apiBaseUrl: string;
}

export function SubmittalEditor({ initial, jobs, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [s, setS] = useState<Submittal>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submittalNumber, setSubmittalNumber] = useState(s.submittalNumber);
  const [revision, setRevision] = useState(s.revision ?? '');
  const [subject, setSubject] = useState(s.subject);
  const [specSection, setSpecSection] = useState(s.specSection ?? '');
  const [submittedTo, setSubmittedTo] = useState(s.submittedTo ?? '');
  const [submittedAt, setSubmittedAt] = useState(s.submittedAt ?? '');
  const [responseDueAt, setResponseDueAt] = useState(s.responseDueAt ?? '');
  const [returnedAt, setReturnedAt] = useState(s.returnedAt ?? '');
  const [reviewerNotes, setReviewerNotes] = useState(s.reviewerNotes ?? '');
  const [leadTimeNote, setLeadTimeNote] = useState(s.leadTimeNote ?? '');
  const [submittalPdfUrl, setSubmittalPdfUrl] = useState(s.submittalPdfUrl ?? '');
  const [returnedPdfUrl, setReturnedPdfUrl] = useState(s.returnedPdfUrl ?? '');
  const [notes, setNotes] = useState(s.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/submittals/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('submittalEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { submittal: Submittal };
      setS(json.submittal);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submittalEditor.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    void patch({
      submittalNumber: submittalNumber.trim() || s.submittalNumber,
      revision: revision.trim() || undefined,
      subject: subject.trim() || s.subject,
      specSection: specSection.trim() || undefined,
      submittedTo: submittedTo.trim() || undefined,
      submittedAt: submittedAt.trim() || undefined,
      responseDueAt: responseDueAt.trim() || undefined,
      returnedAt: returnedAt.trim() || undefined,
      reviewerNotes: reviewerNotes.trim() || undefined,
      leadTimeNote: leadTimeNote.trim() || undefined,
      submittalPdfUrl: submittalPdfUrl.trim() || undefined,
      returnedPdfUrl: returnedPdfUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const days = submittalDaysOutstanding(s);
  const job = jobs.find((j) => j.id === s.jobId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wide text-gray-500">
            {t('submittalEditor.heading', { number: s.submittalNumber })}
            {s.revision && t('submittalEditor.revSuffix', { revision: s.revision })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{s.subject}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {submittalKindLabel(s.kind)}
            {s.specSection && (
              <>
                {' '}{t('submittalEditor.specSuffix', { section: s.specSection })}
              </>
            )}
            {' '}· {job ? job.projectName : s.jobId}
            {days !== undefined && (
              <>
                {' '}{s.returnedAt ? t('submittalEditor.daysReturned', { days }) : t('submittalEditor.daysOutstanding', { days })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={s.kind}
            onChange={(e) => void patch({ kind: e.target.value as SubmittalKind })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {submittalKindLabel(k)}
              </option>
            ))}
          </select>
          <select
            value={s.status}
            onChange={(e) => void patch({ status: e.target.value as SubmittalStatus })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {submittalStatusLabel(st)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('submittalEditor.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('submittalEditor.lblNumber')}>
          <input
            value={submittalNumber}
            onChange={(e) => setSubmittalNumber(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('submittalEditor.lblRevision')}>
          <input
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('submittalEditor.lblSubject')}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblSpecSection')}>
          <input
            value={specSection}
            onChange={(e) => setSpecSection(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblSubmittedTo')}>
          <input
            value={submittedTo}
            onChange={(e) => setSubmittedTo(e.target.value)}
            onBlur={saveAll}
            placeholder={t('submittalEditor.phSubmittedTo')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblSubmittedOn')}>
          <input
            type="date"
            value={submittedAt}
            onChange={(e) => setSubmittedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblResponseDue')}>
          <input
            type="date"
            value={responseDueAt}
            onChange={(e) => setResponseDueAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblReturnedOn')}>
          <input
            type="date"
            value={returnedAt}
            onChange={(e) => setReturnedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <section className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.blocksOrdering}
          onChange={(e) => void patch({ blocksOrdering: e.target.checked })}
          className="h-4 w-4"
        />
        <label>{t('submittalEditor.blocksOrdering')}</label>
      </section>

      <Field label={t('submittalEditor.lblReviewerNotes')}>
        <textarea
          rows={5}
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('submittalEditor.lblLeadTime')}>
          <input
            value={leadTimeNote}
            onChange={(e) => setLeadTimeNote(e.target.value)}
            onBlur={saveAll}
            placeholder={t('submittalEditor.phLeadTime')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('submittalEditor.lblSubmittalPdf')}>
          <input
            value={submittalPdfUrl}
            onChange={(e) => setSubmittalPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('submittalEditor.lblReturnedPdf')}>
          <input
            value={returnedPdfUrl}
            onChange={(e) => setReturnedPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label={t('submittalEditor.lblNotes')}>
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
