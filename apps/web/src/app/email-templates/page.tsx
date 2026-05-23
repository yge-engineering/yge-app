'use client';

// /email-templates — pick a template, fill in context, copy the draft.
//
// Wires bundle 2486's buildEmailReply into a real UI. The dispatcher /
// office staff opens this page, picks one of the 9 most common reply
// patterns, fills in whatever context applies, and gets a draft they
// can copy into the email client. Pure client-side — buildEmailReply
// is a deterministic shared function, no API hop, no LLM, no cost.

import { useMemo, useState } from 'react';
import {
  buildEmailReply,
  EmailReplyContextSchema,
  EmailReplyTemplateKindSchema,
  type EmailReplyContext,
  type EmailReplyTemplateKind,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const KINDS = EmailReplyTemplateKindSchema.options;

const KIND_LABELS: Record<EmailReplyTemplateKind, string> = {
  ACK_BID_INVITATION: 'Acknowledge a bid invitation',
  NO_BID_DECLINE: 'Decline to bid (no-bid)',
  RFI_ACK: 'Acknowledge an incoming RFI',
  SEND_COI_LINK: 'Send our Certificate of Insurance',
  REQUEST_LIEN_WAIVER: 'Request a lien waiver before payment',
  REQUEST_W9: 'Request a W-9 before payment',
  PAYMENT_RECEIVED_ACK: 'Acknowledge receipt of payment',
  SUBMITTAL_ACK: 'Acknowledge a submittal',
  GENERIC_THANKS: 'Generic thank-you / got it',
};

export default function EmailTemplatesPage() {
  const [kind, setKind] = useState<EmailReplyTemplateKind>('ACK_BID_INVITATION');
  const [senderFirstName, setSenderFirstName] = useState('');
  const [inboundSubject, setInboundSubject] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [bidDueDate, setBidDueDate] = useState('');
  const [rfiNumber, setRfiNumber] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [coiUrl, setCoiUrl] = useState('');
  const [signerName, setSignerName] = useState('Ryan Young');
  const [signerTitle, setSignerTitle] = useState('VP');
  const [phone, setPhone] = useState('707-599-9921');
  const [email, setEmail] = useState('ryoung@youngge.com');
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => {
    if (!inboundSubject.trim()) return null;
    const ctxRaw: Record<string, unknown> = {
      senderFirstName: senderFirstName.trim() || undefined,
      inboundSubject: inboundSubject.trim(),
      projectName: projectName.trim() || undefined,
      projectNumber: projectNumber.trim() || undefined,
      bidDueDate: bidDueDate || undefined,
      rfiNumber: rfiNumber.trim() || undefined,
      coiUrl: coiUrl.trim() || undefined,
      ourSignerName: signerName.trim() || 'Ryan Young',
      ourSignerTitle: signerTitle.trim() || 'VP',
      ourPhone: phone.trim() || '707-599-9921',
      ourEmail: email.trim() || 'ryoung@youngge.com',
    };
    if (amountDollars.trim()) {
      const dollars = Number(amountDollars);
      if (Number.isFinite(dollars) && dollars > 0) {
        ctxRaw.amountCents = Math.round(dollars * 100);
      }
    }
    const parsed = EmailReplyContextSchema.safeParse(ctxRaw);
    if (!parsed.success) return null;
    return buildEmailReply(kind, parsed.data as EmailReplyContext);
  }, [
    kind,
    senderFirstName,
    inboundSubject,
    projectName,
    projectNumber,
    bidDueDate,
    rfiNumber,
    amountDollars,
    coiUrl,
    signerName,
    signerTitle,
    phone,
    email,
  ]);

  async function copyDraft() {
    if (!draft) return;
    const text = `${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Email reply templates"
          subtitle="Nine ready-made replies for the most common inbox patterns. Pick a template, fill in what applies, copy + paste. Deterministic — no AI, no surprises."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Inputs</h2>

            <Field label="Template">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as EmailReplyTemplateKind)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sender first name (optional)">
              <input
                value={senderFirstName}
                onChange={(e) => setSenderFirstName(e.target.value)}
                placeholder="Sam"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Inbound subject (required — used for Re: line)">
              <input
                value={inboundSubject}
                onChange={(e) => setInboundSubject(e.target.value)}
                placeholder="Plans for Sulphur Springs Soquol Rd"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Project name (optional)">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Sulphur Springs Soquol Rd"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Project number (optional)">
                <input
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="SS-2026"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Bid due date (ACK_BID_INVITATION)">
                <input
                  type="date"
                  value={bidDueDate}
                  onChange={(e) => setBidDueDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="RFI number (RFI_ACK)">
                <input
                  value={rfiNumber}
                  onChange={(e) => setRfiNumber(e.target.value)}
                  placeholder="14"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount $ (LIEN_WAIVER / PAYMENT)">
                <input
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  placeholder="42137.55"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="COI URL (SEND_COI_LINK)">
                <input
                  value={coiUrl}
                  onChange={(e) => setCoiUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-gray-700">Signature block</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Signer name">
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Signer title">
                <input
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Draft</h2>
              <button
                type="button"
                onClick={copyDraft}
                disabled={!draft}
                className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy draft'}
              </button>
            </div>
            {draft ? (
              <>
                <div className="mb-3 rounded bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">Subject:</span>{' '}
                  <span className="text-gray-900">{draft.subject}</span>
                </div>
                <pre className="whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 font-sans text-sm leading-relaxed text-gray-900">
                  {draft.body}
                </pre>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Enter the inbound subject (and any other relevant context) to
                see the draft here.
              </p>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
