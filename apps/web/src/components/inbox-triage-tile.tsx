// Inbox-triage dashboard tile — morning glance.
//
// Plain English: bookkeeper wakes up, hits Run, sees "5 bid invites,
// 2 RFIs, 1 vendor bill, 0 spam" + the one-line action for each
// flagged message. AI takes ~5s for 25 messages. Read-only for v1;
// auto-file + draft-reply ship next.

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
}

const CATEGORY_LABELS: Record<TriagedMessage['category'], string> = {
  BID_INVITATION: 'Bid invitation',
  RFI: 'RFI',
  LIEN_WAIVER: 'Lien waiver',
  VENDOR_BILL: 'Vendor bill',
  CUSTOMER_PAYMENT: 'Customer payment',
  AGENCY_NOTICE: 'Agency notice',
  EMPLOYEE_HR: 'Employee / HR',
  INTERNAL: 'Internal',
  SPAM: 'Spam',
  OTHER: 'Other',
};

// Surfacing-priority order for the inbox tile. High-value categories
// get rendered first; SPAM + OTHER sink to the bottom.
const PRIORITY: TriagedMessage['category'][] = [
  'BID_INVITATION',
  'AGENCY_NOTICE',
  'CUSTOMER_PAYMENT',
  'VENDOR_BILL',
  'RFI',
  'LIEN_WAIVER',
  'EMPLOYEE_HR',
  'INTERNAL',
  'OTHER',
  'SPAM',
];

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function InboxTriageTile({
  email,
  microsoftConnected,
}: {
  email: string;
  microsoftConnected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TriagedMessage[] | null>(null);
  const [filed, setFiled] = useState<Set<string>>(new Set());
  const [filing, setFiling] = useState<Set<string>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);

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

  if (!microsoftConnected) {
    return (
      <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">📥 Inbox triage</h2>
        <p className="mt-1 text-sm text-gray-600">
          Connect your Outlook on{' '}
          <a href="/files" className="text-yge-blue-700 underline">
            /files
          </a>{' '}
          to enable AI inbox classification (bid invites, RFIs, vendor
          bills, agency notices).
        </p>
      </section>
    );
  }

  // Counts by category in priority order.
  const counts: Array<{ category: TriagedMessage['category']; n: number }> =
    messages
      ? PRIORITY.map((c) => ({
          category: c,
          n: messages.filter((m) => m.category === c).length,
        })).filter((c) => c.n > 0)
      : [];

  const top = messages
    ? [...messages]
        .filter((m) => m.category !== 'SPAM' && m.category !== 'OTHER')
        .sort((a, b) => {
          const pa = PRIORITY.indexOf(a.category);
          const pb = PRIORITY.indexOf(b.category);
          if (pa !== pb) return pa - pb;
          return b.receivedAtIso.localeCompare(a.receivedAtIso);
        })
        .slice(0, 5)
    : [];

  async function fileToJob(
    items: Array<{ messageId: string; jobId: string }>,
  ) {
    if (items.length === 0) return;
    setFileError(null);
    setFiling((prev) => {
      const next = new Set(prev);
      for (const i of items) next.add(i.messageId);
      return next;
    });
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/microsoft/inbox-triage/file-to-job`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, items }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setFileError(body.error ?? `File failed (${res.status})`);
        return;
      }
      const out = (await res.json()) as {
        moved: Array<{ messageId: string }>;
        skipped: Array<{ messageId: string }>;
      };
      setFiled((prev) => {
        const next = new Set(prev);
        for (const m of out.moved) next.add(m.messageId);
        for (const m of out.skipped) next.add(m.messageId);
        return next;
      });
    } catch (err) {
      setFileError((err as Error).message);
    } finally {
      setFiling((prev) => {
        const next = new Set(prev);
        for (const i of items) next.delete(i.messageId);
        return next;
      });
    }
  }

  const fileableHigh = (messages ?? []).filter(
    (m) => m.suggestedJob && m.suggestedJob.confidence === 'high' && !filed.has(m.id),
  );

  return (
    <section className="mb-6 rounded-md border border-yge-blue-200 bg-yge-blue-50 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-yge-blue-900">
            📥 Inbox triage
          </h2>
          <p className="text-xs text-gray-600">
            Reads your last 25 emails and classifies each. Read-only —
            no auto-file, no auto-reply.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {messages && fileableHigh.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                fileToJob(
                  fileableHigh.map((m) => ({
                    messageId: m.id,
                    jobId: m.suggestedJob!.jobId,
                  })),
                )
              }
              className="rounded-md border border-yge-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-100"
            >
              File all HIGH ({fileableHigh.length})
            </button>
          ) : null}
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-md bg-yge-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {busy ? 'Reading inbox…' : messages ? 'Refresh' : 'Run inbox triage'}
          </button>
        </div>
      </header>

      {error ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}
      {fileError ? (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          File error: {fileError}
        </p>
      ) : null}

      {messages ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.length === 0 ? (
              <span className="text-xs text-gray-600">No messages found.</span>
            ) : (
              counts.map((c) => (
                <span
                  key={c.category}
                  className="rounded-full border border-yge-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-yge-blue-800"
                >
                  {CATEGORY_LABELS[c.category]}: {c.n}
                </span>
              ))
            )}
          </div>

          {top.length > 0 ? (
            <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-xs">
              {top.map((m) => (
                <li key={m.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {m.subject}
                      </div>
                      <div className="text-gray-600 truncate">
                        {m.fromName
                          ? `${m.fromName} <${m.fromAddress}>`
                          : m.fromAddress}
                      </div>
                      <div className="mt-0.5 text-gray-700">
                        {m.nextAction}
                      </div>
                      {m.suggestedJob ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
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
                          {filed.has(m.id) ? (
                            <span className="rounded border border-green-300 bg-green-50 px-1.5 py-0.5 text-green-800">
                              Filed ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={filing.has(m.id)}
                              onClick={() =>
                                fileToJob([
                                  {
                                    messageId: m.id,
                                    jobId: m.suggestedJob!.jobId,
                                  },
                                ])
                              }
                              className="rounded border border-yge-blue-300 bg-white px-1.5 py-0.5 font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50"
                            >
                              {filing.has(m.id) ? 'Filing…' : 'File'}
                            </button>
                          )}
                        </div>
                      ) : null}
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
                      {CATEGORY_LABELS[m.category]} · {m.confidence}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
