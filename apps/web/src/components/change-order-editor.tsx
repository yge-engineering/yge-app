'use client';

import { useState } from 'react';
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
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { changeOrder: ChangeOrder };
      setCo(json.changeOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
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
      setError('Line description is required.');
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
            Change Order #{co.changeOrderNumber}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{co.subject}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : co.jobId}
            {' '}\u00b7 {changeOrderReasonLabel(co.reason)}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${cost > 0 ? 'text-green-700' : cost < 0 ? 'text-orange-700' : 'text-gray-700'}`}>
            {cost === 0 ? '—' : cost > 0 ? `+${formatUSD(cost)}` : `-${formatUSD(-cost)}`}
          </div>
          <div className="text-xs text-gray-500">
            {co.totalScheduleImpactDays === 0
              ? 'no schedule impact'
              : co.totalScheduleImpactDays > 0
                ? `+${co.totalScheduleImpactDays} day${co.totalScheduleImpactDays === 1 ? '' : 's'}`
                : `${co.totalScheduleImpactDays} day${co.totalScheduleImpactDays === -1 ? '' : 's'}`}
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
          {saving && <div className="text-xs text-gray-500">Saving&hellip;</div>}
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
          <Field label="Originating RFI">
            <select
              value={co.originRfiId ?? ''}
              onChange={(e) => void patch({ originRfiId: e.target.value || undefined })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Not linked —</option>
              {rfis.map((r) => (
                <option key={r.id} value={r.id}>
                  RFI #{r.rfiNumber} — {r.subject}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="CO number">
          <input
            value={changeOrderNumber}
            onChange={(e) => setChangeOrderNumber(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Proposed">
          <input
            type="date"
            value={proposedAt}
            onChange={(e) => setProposedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Approved">
          <input
            type="date"
            value={approvedAt}
            onChange={(e) => setApprovedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Executed">
          <input
            type="date"
            value={executedAt}
            onChange={(e) => setExecutedAt(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="New contract amount ($)">
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
        <Field label="New completion date">
          <input
            type="date"
            value={newCompletionDate}
            onChange={(e) => setNewCompletionDate(e.target.value)}
            onBlur={saveAll}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label="Description (full narrative)">
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
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Cost breakdown</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-5">
            <Field label="Description">
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Additional rip-rap at STA 14+50"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Amount ($, negative = deduct)">
              <input
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Schedule impact (days)">
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
                Add line
              </button>
            </div>
          </div>
        </div>

        {co.lineItems.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No cost lines yet.</p>
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
                      {li.scheduleDays > 0 ? `+${li.scheduleDays}` : li.scheduleDays} day{Math.abs(li.scheduleDays) === 1 ? '' : 's'}
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
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Proposal PDF URL">
          <input
            value={proposalPdfUrl}
            onChange={(e) => setProposalPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Executed PDF URL">
          <input
            value={executedPdfUrl}
            onChange={(e) => setExecutedPdfUrl(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      <Field label="Internal notes">
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
