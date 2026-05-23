'use client';

// /w9-chase-email — draft a W-9 chase email.
//
// Wires bundle 2526's buildW9ChaseEmail. Office picks the vendor +
// YTD payments + first/second notice flag; page shows the subject
// + body. Copy + paste into Outlook.

import { useMemo, useState } from 'react';

import {
  W9ChaseInputSchema,
  buildW9ChaseEmail,
  type W9ChaseInput,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function W9ChaseEmailPage() {
  const [vendorName, setVendorName] = useState('Acme Hardware LLC');
  const [vendorContactName, setVendorContactName] = useState('Sam Smith');
  const [vendorEmail, setVendorEmail] = useState('ap@acmehardware.example');
  const [ytdDollars, setYtdDollars] = useState('12450');
  const [secondNotice, setSecondNotice] = useState(false);
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [signerName, setSignerName] = useState('Ryan Young');
  const [signerTitle, setSignerTitle] = useState('VP');
  const [phone, setPhone] = useState('707-599-9921');
  const [email, setEmail] = useState('ryoung@youngge.com');
  const [uploadUrl, setUploadUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => {
    const raw: Record<string, unknown> = {
      vendorName: vendorName.trim(),
      vendorContactName: vendorContactName.trim() || undefined,
      vendorEmail: vendorEmail.trim() || undefined,
      ytdPaymentsCents: Math.round((Number(ytdDollars) || 0) * 100),
      secondNotice,
      asOfDate,
      ourSignerName: signerName.trim() || 'Ryan Young',
      ourSignerTitle: signerTitle.trim() || 'VP',
      ourPhone: phone.trim() || '707-599-9921',
      ourEmail: email.trim() || 'ryoung@youngge.com',
      uploadUrl: uploadUrl.trim() || undefined,
    };
    const parsed = W9ChaseInputSchema.safeParse(raw);
    return parsed.success ? buildW9ChaseEmail(parsed.data as W9ChaseInput) : null;
  }, [
    vendorName,
    vendorContactName,
    vendorEmail,
    ytdDollars,
    secondNotice,
    asOfDate,
    signerName,
    signerTitle,
    phone,
    email,
    uploadUrl,
  ]);

  async function copyAll() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // older browsers
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="W-9 chase email"
          subtitle="Draft a vendor W-9 chase email. First notice is friendly; second notice adds the IRC §3406 24% backup-withholding warning."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Vendor</h2>
            <Field label="Vendor name">
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Contact first + last">
              <input value={vendorContactName} onChange={(e) => setVendorContactName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Vendor email (for the To: field)">
              <input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="YTD paid ($)">
                <input value={ytdDollars} onChange={(e) => setYtdDollars(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="As of date">
                <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className={INPUT} />
              </Field>
            </div>
            <Field label="Secure upload URL (optional)">
              <input value={uploadUrl} onChange={(e) => setUploadUrl(e.target.value)} className={INPUT} />
            </Field>
            <label className="mt-3 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={secondNotice}
                onChange={(e) => setSecondNotice(e.target.checked)}
              />
              Second notice (adds 24% backup-withholding warning per IRC §3406)
            </label>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Signed by</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Title">
                <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Draft</h2>
              <button
                type="button"
                onClick={copyAll}
                disabled={!draft}
                className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy subject + body'}
              </button>
            </div>
            {draft ? (
              <>
                <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">Subject:</span>{' '}
                  <span className="text-gray-900">{draft.subject}</span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 font-sans text-sm leading-relaxed text-gray-900">
                  {draft.body}
                </pre>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Fill in vendor name + YTD amount to see the draft.
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
