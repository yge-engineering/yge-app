// Full /inbox-triage page client component.
//
// Mirrors InboxTriageTile but shows ALL messages (not top 5),
// grouped by category, with the same File / Draft-AP buttons.

'use client';

import { useState } from 'react';

interface TriagedMessage {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string;
  receivedAtIso: string;
  category:
    | 'BID_INVITATION'
    | 'RFI'
    | 'LIEN_WAIVER'
    | 'COI'
    | 'SUBMITTAL'
    | 'VENDOR_BILL'
    | 'CUSTOMER_PAYMENT'
    | 'AGENCY_NOTICE'
    | 'EMPLOYEE_HR'
    | 'INTERNAL'
    | 'SPAM'
    | 'OTHER';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  nextAction: string;
  suggestedJob: {
    jobId: string;
    projectName: string;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  } | null;
  suggestedVendor: {
    vendorId: string;
    vendorName: string;
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
  } | null;
}

const CATEGORY_LABELS: Record<TriagedMessage['category'], string> = {
  BID_INVITATION: 'Bid invitation',
  RFI: 'RFI',
  LIEN_WAIVER: 'Lien waiver',
  COI: 'Insurance cert (COI)',
  SUBMITTAL: 'Submittal',
  VENDOR_BILL: 'Vendor bill',
  CUSTOMER_PAYMENT: 'Customer payment',
  AGENCY_NOTICE: 'Agency notice',
  EMPLOYEE_HR: 'Employee / HR',
  INTERNAL: 'Internal',
  SPAM: 'Spam',
  OTHER: 'Other',
};

const PRIORITY: TriagedMessage['category'][] = [
  'BID_INVITATION',
  'AGENCY_NOTICE',
  'CUSTOMER_PAYMENT',
  'VENDOR_BILL',
  'RFI',
  'LIEN_WAIVER',
  'COI',
  'SUBMITTAL',
  'EMPLOYEE_HR',
  'INTERNAL',
  'OTHER',
  'SPAM',
];

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function InboxTriageFull({
  email,
  microsoftConnected,
}: {
  email: string;
  microsoftConnected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TriagedMessage[] | null>(null);
  const [drafting, setDrafting] = useState<Set<string>>(new Set());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [hideSpam, setHideSpam] = useState(true);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/microsoft/inbox-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, max: 25 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Triage failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { messages: TriagedMessage[] };
      setMessages(body.messages);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function draftApFromEmail(messageId: string) {
    setDraftError(null);
    setDrafting((prev) => new Set(prev).add(messageId));
    try {
      const res = await fetch(`${apiBaseUrl()}/api/ap-invoices/draft-from-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, messageId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setDraftError(body.error ?? `Draft failed (${res.status})`);
        setDrafting((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }
      const body = (await res.json()) as { invoice: { id: string } };
      window.location.href = `/ap-invoices/${body.invoice.id}`;
    } catch (err) {
      setDraftError((err as Error).message);
      setDrafting((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  if (!microsoftConnected) {
    return (
      <section className="rounded-md border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-700">
          Connect your Outlook on{' '}
          <a href="/files" className="text-yge-blue-700 underline">
            /files
          </a>{' '}
          to enable inbox triage.
        </p>
      </section>
    );
  }

  // Group messages by category, ordered by PRIORITY.
  const byCategory = new Map<TriagedMessage['category'], TriagedMessage[]>();
  for (const m of messages ?? []) {
    if (hideSpam && (m.category === 'SPAM' || m.category === 'OTHER')) continue;
    const arr = byCategory.get(m.category) ?? [];
    arr.push(m);
    byCategory.set(m.category, arr);
  }
  for (const [, arr] of byCategory) {
    arr.sort((a, b) => b.receivedAtIso.localeCompare(a.receivedAtIso));
  }

  const orderedCats = PRIORITY.filter((c) => byCategory.has(c));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Reading inbox…' : messages ? 'Refresh' : 'Run inbox triage'}
        </button>
        {messages ? (
          <label className="flex items-center gap-1 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={hideSpam}
              onChange={(e) => setHideSpam(e.target.checked)}
            />
            Hide SPAM and OTHER
          </label>
        ) : null}
        {messages ? (
          <span className="ml-auto text-xs text-gray-600">
            {messages.length} message{messages.length === 1 ? '' : 's'} ·{' '}
            {orderedCats.length} categor{orderedCats.length === 1 ? 'y' : 'ies'}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : null}
      {draftError ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          AP draft error: {draftError}
        </div>
      ) : null}

      {!messages ? (
        <p className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Click <strong>Run inbox triage</strong> to classify your last 25
          messages.
        </p>
      ) : (
        <div className="space-y-4">
          {orderedCats.map((cat) => {
            const rows = byCategory.get(cat) ?? [];
            return (
              <section
                key={cat}
                className="rounded-md border border-gray-200 bg-white"
              >
                <header className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                    {CATEGORY_LABELS[cat]} ({rows.length})
                  </h2>
                </header>
                <ul className="divide-y divide-gray-100">
                  {rows.map((m) => (
                    <li key={m.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-gray-900">
                            {m.subject}
                          </div>
                          <div className="truncate text-xs text-gray-600">
                            {m.fromName
                              ? `${m.fromName} <${m.fromAddress}>`
                              : m.fromAddress}
                            <span className="ml-2 text-gray-500">
                              {m.receivedAtIso.slice(0, 10)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-700">
                            {m.nextAction}
                          </p>
                          {m.suggestedJob ? (
                            <div className="mt-1 text-[11px]">
                              <a
                                href={`/jobs/${m.suggestedJob.jobId}`}
                                className="text-yge-blue-700 underline"
                                title={m.suggestedJob.reasons.join('; ')}
                              >
                                → {m.suggestedJob.projectName}
                                <span className="ml-1 text-gray-500">
                                  ({m.suggestedJob.confidence})
                                </span>
                              </a>
                            </div>
                          ) : null}
                          {m.suggestedVendor ? (
                            <div className="mt-1 text-[11px]">
                              <a
                                href={`/vendors/${m.suggestedVendor.vendorId}`}
                                className="text-yge-blue-700 underline"
                                title={m.suggestedVendor.reasons.join('; ')}
                              >
                                → {m.suggestedVendor.vendorName}
                                <span className="ml-1 text-gray-500">
                                  ({m.suggestedVendor.confidence})
                                </span>
                              </a>
                            </div>
                          ) : null}
                          {m.category === 'VENDOR_BILL' ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                disabled={drafting.has(m.id)}
                                onClick={() => void draftApFromEmail(m.id)}
                                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {drafting.has(m.id)
                                  ? 'Drafting…'
                                  : '→ Draft AP invoice'}
                              </button>
                              <span className="ml-2 text-[11px] text-gray-500">
                                AI reads the PDF and creates a DRAFT for review
                              </span>
                            </div>
                          ) : null}
                          {(() => {
                            const ROUTE: Partial<
                              Record<TriagedMessage['category'], { href: string; label: string }>
                            > = {
                              COI: { href: '/coi-chase', label: 'Log certificate of insurance' },
                              SUBMITTAL: { href: '/submittals/new', label: 'Log submittal' },
                              RFI: { href: '/rfis', label: 'Open RFIs' },
                              LIEN_WAIVER: { href: '/lien-waivers', label: 'Open lien waivers' },
                            };
                            const route = ROUTE[m.category];
                            return route ? (
                              <div className="mt-2">
                                <a
                                  href={route.href}
                                  className="inline-block rounded border border-yge-blue-300 bg-yge-blue-50 px-2 py-1 text-[11px] font-semibold text-yge-blue-800 hover:bg-yge-blue-100"
                                >
                                  → {route.label}
                                </a>
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                            m.confidence === 'HIGH'
                              ? 'border-green-300 bg-green-50 text-green-800'
                              : m.confidence === 'MEDIUM'
                                ? 'border-amber-300 bg-amber-50 text-amber-800'
                                : 'border-gray-300 bg-gray-50 text-gray-700'
                          }`}
                        >
                          {m.confidence}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
