// /jobs/[id]/bid-invite — printable bid invitation letter.

import { notFound } from 'next/navigation';

import { Money } from '../../../../components/money';
import { requirePermission } from '../../../../lib/permissions';
import { PrintButton } from '../../../../components/print-button';
import { type Job, YGE_COMPANY_INFO } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { job?: Job };
    return body.job ?? null;
  } catch {
    return null;
  }
}

export default async function BidInvitePage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('estimates:view');
  const job = await fetchJob(params.id);
  if (!job) notFound();

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
      <div className="print:hidden mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-yge-blue-900">
            Bid invitation — {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            Print + mail / email to subs. Hand-fill the recipient,
            trade(s), and RSVP date inline.
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-2xl bg-white p-8 text-sm leading-relaxed">
        <header className="mb-6 border-b border-gray-300 pb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {YGE_COMPANY_INFO.legalName}
          </div>
          <div className="text-xs text-gray-600">
            {YGE_COMPANY_INFO.address.street} · {YGE_COMPANY_INFO.address.city},{' '}
            {YGE_COMPANY_INFO.address.state} {YGE_COMPANY_INFO.address.zip} ·
            CSLB {YGE_COMPANY_INFO.cslbLicense} · DIR {YGE_COMPANY_INFO.dirNumber}
          </div>
        </header>

        <p className="text-right text-xs text-gray-700">{today}</p>

        <section className="mt-4 leading-snug text-xs text-gray-700">
          <div>To: __________________________________</div>
          <div>Attn: __________________________________</div>
          <div>Address: __________________________________</div>
          <div>Email / Fax: __________________________________</div>
        </section>

        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide">
          Re: Invitation to bid — {job.projectName}
        </h2>

        <p className="mt-3">Dear Sir/Madam,</p>

        <p className="mt-3">
          {YGE_COMPANY_INFO.legalName} is preparing a bid for the project
          referenced above and would like to invite your company to submit
          a quote. Project details below — please respond by the RSVP
          date so we can finalize our §4104 sub list before bid open.
        </p>

        <section className="mt-4 rounded border border-gray-300 p-3 text-xs">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <dt className="font-semibold text-gray-600">Project name</dt>
              <dd>{job.projectName}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Awarding agency</dt>
              <dd>{job.ownerAgency ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Project location</dt>
              <dd>{job.location ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Bid due (agency)</dt>
              <dd>{job.bidDueDate ?? '__________'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Engineer's estimate</dt>
              <dd className="font-mono">
                {job.engineersEstimateCents != null ? (
                  <Money cents={job.engineersEstimateCents} />
                ) : (
                  '__________'
                )}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Project type</dt>
              <dd>{job.projectType}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 text-xs">
          <h3 className="font-semibold text-gray-700">Trades requested</h3>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            <li>__________________________________</li>
            <li>__________________________________</li>
            <li>__________________________________</li>
          </ul>
        </section>

        <section className="mt-4 text-xs">
          <h3 className="font-semibold text-gray-700">RSVP / quote due</h3>
          <p className="mt-1">
            Please return your quote by{' '}
            <strong>__________________</strong> to:
          </p>
          <p className="mt-1">
            {YGE_COMPANY_INFO.legalName} ·{' '}
            <a
              href="mailto:bids@youngge.com"
              className="text-yge-blue-700 underline"
            >
              bids@youngge.com
            </a>
          </p>
          <p className="mt-1 text-gray-600">
            Plans + specs are available on request. Subs that quote
            below the engineer's estimate will be considered for the
            §4104 list submitted with our prime bid.
          </p>
        </section>

        <p className="mt-6">Thank you,</p>
        <p className="mt-8">{job.pursuitOwner ?? '_________________________'}</p>
        <p className="text-xs text-gray-600">
          {YGE_COMPANY_INFO.legalName}
        </p>
      </article>

      <p className="mt-4 text-[11px] text-gray-500 print:mt-2">
        Generated {new Date().toISOString().slice(0, 16)} by YGE App.
      </p>
    </main>
  );
}
