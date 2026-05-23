'use client';

// /subcontract-builder — draft a subcontract cover letter.
//
// Wires bundle 2517's buildSubcontractCover into a real office tool.
// Fill in the sub + scope + amount, get the cover-letter body + the
// enclosure checklist. Copy and paste into the email or PDF.

import { useMemo, useState } from 'react';

import {
  SubcontractCoverInputSchema,
  buildSubcontractCover,
  type SubcontractCoverInput,
} from '@yge/shared';

import { AppShell, PageHeader } from '../../components';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

export default function SubcontractBuilderPage() {
  const [projectName, setProjectName] = useState('Sulphur Springs Soquol Rd');
  const [projectNumber, setProjectNumber] = useState('');
  const [ownerAgency, setOwnerAgency] = useState('');
  const [subName, setSubName] = useState('Acme Concrete Inc.');
  const [subContactName, setSubContactName] = useState('Sam Smith');
  const [subAddress, setSubAddress] = useState('123 Main St, Ukiah CA 95482');
  const [scope, setScope] = useState(
    'Furnish + install concrete sidewalks per plans + specs. Approx. 1,200 LF, 4-in. thick, broom finish.',
  );
  const [amountDollars, setAmountDollars] = useState('48000');
  const [retentionPct, setRetentionPct] = useState('5');
  const [letterDate, setLetterDate] = useState(todayIso());
  const [startDate, setStartDate] = useState('');
  const [pw, setPw] = useState(false);
  const [signerName, setSignerName] = useState('Ryan Young');
  const [signerTitle, setSignerTitle] = useState('VP');
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => {
    const raw: Record<string, unknown> = {
      projectName: projectName.trim(),
      projectNumber: projectNumber.trim() || undefined,
      ownerAgency: ownerAgency.trim() || undefined,
      subName: subName.trim(),
      subContactName: subContactName.trim(),
      subAddress: subAddress.trim(),
      scopeDescription: scope.trim(),
      contractAmountCents: Math.round((Number(amountDollars) || 0) * 100),
      retentionPct: (Number(retentionPct) || 0) / 100,
      letterDate,
      startDate: startDate || undefined,
      prevailingWage: pw,
      ourSignerName: signerName.trim() || 'Ryan Young',
      ourSignerTitle: signerTitle.trim() || 'VP',
    };
    const parsed = SubcontractCoverInputSchema.safeParse(raw);
    if (!parsed.success) return null;
    return buildSubcontractCover(parsed.data as SubcontractCoverInput);
  }, [
    projectName,
    projectNumber,
    ownerAgency,
    subName,
    subContactName,
    subAddress,
    scope,
    amountDollars,
    retentionPct,
    letterDate,
    startDate,
    pw,
    signerName,
    signerTitle,
  ]);

  async function copyLetter() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — older browsers
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <PageHeader
          title="Subcontract cover-letter builder"
          subtitle="Fill in the sub + scope + amount; the standard YGE insurance / lien-waiver / safety / indemnity clauses pull in automatically. Public-works clause toggles in when needed."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Project</h2>
            <Field label="Project name">
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project number (optional)">
                <input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Owner / awarding agency (optional)">
                <input value={ownerAgency} onChange={(e) => setOwnerAgency(e.target.value)} className={INPUT} />
              </Field>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pw} onChange={(e) => setPw(e.target.checked)} />
              Public-works job (adds DIR + CPR + DAS-140/142 clause)
            </label>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Sub</h2>
            <Field label="Sub name">
              <input value={subName} onChange={(e) => setSubName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Contact name (first + last)">
              <input value={subContactName} onChange={(e) => setSubContactName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Address">
              <input value={subAddress} onChange={(e) => setSubAddress(e.target.value)} className={INPUT} />
            </Field>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Scope + terms</h2>
            <Field label="Scope description">
              <textarea
                rows={4}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className={INPUT}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Amount ($)">
                <input value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Retention (%)">
                <input value={retentionPct} onChange={(e) => setRetentionPct(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Letter date">
                <input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className={INPUT} />
              </Field>
            </div>
            <Field label="Start date (optional)">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </Field>

            <h2 className="mt-6 text-lg font-semibold text-gray-900">Signed by</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Title">
                <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={INPUT} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Draft letter</h2>
              <button
                type="button"
                onClick={copyLetter}
                disabled={!draft}
                className="rounded bg-yge-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy letter'}
              </button>
            </div>
            {draft ? (
              <pre className="mt-3 whitespace-pre-wrap rounded border border-gray-200 bg-white p-4 font-sans text-sm leading-relaxed text-gray-900">
                {draft.body}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                Fill in the project + sub fields above to see the draft.
              </p>
            )}

            {draft && (
              <>
                <h3 className="mt-6 text-sm font-semibold text-gray-700">
                  Enclosures the sub must return
                </h3>
                <ol className="mt-2 list-decimal pl-5 text-sm text-gray-800">
                  {draft.enclosureList.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ol>
              </>
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
