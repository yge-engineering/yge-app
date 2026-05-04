'use client';

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  changeOrderReasonLabel,
  changeOrderStatusLabel,
  formatUSD,
  type ChangeOrder,
  type ChangeOrderLineItem,
  type ChangeOrderReason,
  type ChangeOrderStatus,
  type Job,
  type Rfi,
} from '@yge/shared';

const STATUSES: ChangeOrderStatus[] = [
  'PROPOSED',
  'AGENCY_REVIEW',
  'APPROVED',
  'EXECUTED',
  'REJECTED',
  'WITHDRAWN',
];

const REASONS: ChangeOrderReason[] = [
  'OWNER_DIRECTED',
  'DIFFERING_SITE_CONDITION',
  'DESIGN_REVISION',
  'RFI_RESPONSE',
  'CODE_REVISION',
  'WEATHER_OR_DELAY',
  'SCOPE_CLARIFICATION',
  'OTHER',
];

interface Props {
  initial: ChangeOrder;
  jobs: Job[];
  rfis: Rfi[];
  apiBaseUrl: string;
}

export function ChangeOrderEditor({ initial, jobs, rfis, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [co, setCo] = useState<ChangeOrder>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [changeOrderNumber, setChangeOrderNumber] = useState(co.changeOrderNumber);
  const [subject, setSubject] = useState(co.subject);
  const [description, setDescription] = useState(co.description);
  const [proposedAt, setProposedAt] = useState(co.proposedAt ?? '');
  const [approvedAt, setApprovedAt] = useState(co.approvedAt ?? '');
  const [executedAt, setExecutedAt] = useState(co.executedAt ?? '');
  const [newContractDollars, setNewContractDollars] = useState(
    co.newContractAmountCents !== undefined
      ? (co.newContractAmountCents / 100).toFixed(2)
      : '',
  );
  const [newCompletionDate, setNewCompletionDate] = useState(co.newCompletionDate ?? '');
  const [proposalPdfUrl, setProposalPdfUrl] = useState(co.proposalPdfUrl ?? '');
  const [executedPdfUrl, setExecutedPdfUrl] = useState(co.executedPdfUrl ?? '');
  const [notes, setNotes] = useState(co.notes ?? '');

  // Line item form.
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDays, setNewDays] = useState('');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/change-orders/${co.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('changeOrder.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { changeOrder: ChangeOrder };
      setCo(json.changeOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('changeOrder.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function saveAll() {
    void patch({
      changeOrderNumber: changeOrderNumber.trim() || co.changeOrderNumber,
      subject: subject.trim() || co.subject,
      description,
      proposedAt: proposedAt.trim() || undefined,
      approvedAt: approvedAt.trim() || undefined,
      executedAt: executedAt.trim() || undefined,
      newContractAmountCents: newContractDollars.trim()
        ? Math.round(Number(newContractDollars) * 100)
        : undefined,
      newCompletionDate: newCompletionDate.trim() || undefined,
      proposalPdfUrl: proposalPdfUrl.trim() || undefined,
      executedPdfUrl: executedPdfUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  function addLine() {
    if (newDesc.trim().length === 0) {
      setError(t('changeOrder.errLineDesc'));
      return;
    }
    const amountCents = Math.round(Number(newAmount || '0') * 100);
    const line: ChangeOrderLineItem = {
      description: newDesc.trim(),
      amountCents,
      ...(newDays.trim() ? { scheduleDays: Number(newDays) } : {}),
    };
    void patch({ lineItems: [...co.lineItems, line] });
    setNewDesc('');
    setNewAmount('');
    setNewDays('');
  }

  function removeLine(i: number) {
    void patch({ lineItems: co.lineItems.filter((_, idx) => idx !== i) });
  }

  const job = jobs.find((j) => j.id === co.jobId);
  const cost = co.totalCostImpactCents;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wide text-gray-500">
            {t('changeOrder.heading', { number: co.changeOrderNumber })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{co.subject}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : co.jobId}
            {' '}· {changeOrderReasonLabel(co.reason)}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${cost > 0 ? 'text-green-700' : cost < 0 ? 'text-orange-700' : 'text-gray-700'}`}>
            {cost === 0 ? '—' : cost > 0 ? `+${formatUSD(cost)}` : `-${formatUSD(-cost)}`}
          </div>
          <div className="text-xs text-gray-500">
            {co.totalScheduleImpactDays === 0
              ? t('changeOrder.noScheduleImpact')
              : co.totalScheduleImpactDays > 0
                ? co.totalScheduleImpactDays === 1
                  ? t('changeOrder.daysPlusOne')
                  : t('changeOrder.daysPlusMany', { days: co.totalScheduleImpactDays })
                : co.totalScheduleImpactDays === -1
                  ? t('changeOrder.daysMinusOne')
                  : t('changeOrder.daysMinusMany', { days: co.totalScheduleImpactDays })}
          </div>
          <div className="mt-2 flex justify-end gap-2 text-xs">
            <select
              value={co.reason}
              onChange={(e) => void patch({ reason: e.target.value as ChangeOrderReason })}
              className="rounded border border-gray-300 px-2 py-1"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {changeOrderReasonLabel(r)}
                </option>
              ))}
            </select>
            <select
              value={co.status}
              onChange={(e) => void patch({ status: e.target.value as ChangeOrderStatus })}
              className="rounded border border-gray-300 px-2 py-1"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {changeOrderStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          {saving && <div className="text-xs text-gray-500">{t('changeOrder.saving')}</div>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Origin link */}
      {rfis.length > 0 && (
        <section>
          <Field label={t('changeOrder.lblOriginRfi')}>
            <select
              value={co.originRfiId ?? ''}
              onChange={(e) => void patch({ originRfiId: e.target.value || undefined })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">{t('changeOrder.notLinked')}</option>
              {rfis.map((r) => (
                <option key={r.id} value={r.id}>
                  {t('changeOrder.rfiOption', { number: r.rfiNumber, subject: r.subject })}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('changeOrder.lblNumber')}>
          <input
            value={changeOrderNumber}
            onChange={(e) => setChangeOrderNumber(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('changeOrder.lblSubject')}>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblProposed')}>
          <input
            type="date"
            value={proposedAt}
            onChange={(e) => setProposedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblApproved')}>
          <input
            type="date"
            value={approvedAt}
            onChange={(e) => setApprovedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblExecuted')}>
          <input
            type="date"
            value={executedAt}
            onChange={(e) => setExecutedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblNewContract')}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={newContractDollars}
            onChange={(e) => setNewContractDollars(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblNewCompletion')}>
          <input
            type="date"
            value={newCompletionDate}
            onChange={(e) => setNewCompletionDate(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label={t('changeOrder.lblDescription')}>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveAll}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>

      {/* Line items */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('changeOrder.costBreakdown')}</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-5">
            <Field label={t('changeOrder.lblLineDesc')}>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t('changeOrder.phLineDesc')}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('changeOrder.lblLineAmount')}>
              <input
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('changeOrder.lblLineSchedule')}>
              <input
                type="number"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <div className="col-span-2 self-end">
              <button
                type="button"
                onClick={addLine}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                {t('changeOrder.addLine')}
              </button>
            </div>
          </div>
        </div>

        {co.lineItems.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('changeOrder.emptyLines')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {co.lineItems.map((li, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <div>
                  <div className="font-medium text-gray-900">{li.description}</div>
                  {li.scheduleDays !== undefined && li.scheduleDays !== 0 && (
                    <div className="text-xs text-gray-500">
                      {Math.abs(li.scheduleDays) === 1 ? (li.scheduleDays > 0 ? t('changeOrder.daysPlusOne') : t('changeOrder.daysMinusOne')) : (li.scheduleDays > 0 ? t('changeOrder.daysPlusMany', { days: li.scheduleDays }) : t('changeOrder.daysMinusMany', { days: li.scheduleDays }))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`font-medium tabular-nums ${li.amountCents > 0 ? 'text-green-700' : li.amountCents < 0 ? 'text-orange-700' : 'text-gray-700'}`}>
                    {li.amountCents > 0
                      ? `+${formatUSD(li.amountCents)}`
                      : li.amountCents < 0
                        ? `-${formatUSD(-li.amountCents)}`
                        : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('changeOrder.removeLine')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('changeOrder.lblProposalPdf')}>
          <input
            value={proposalPdfUrl}
            onChange={(e) => setProposalPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('changeOrder.lblExecutedPdf')}>
          <input
            value={executedPdfUrl}
            onChange={(e) => setExecutedPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label={t('changeOrder.lblNotes')}>
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
