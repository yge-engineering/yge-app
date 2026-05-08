// /jobs/[id]/das-140 — DAS-140 Notice of Contract Award.

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

export default async function Das140Page({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('financials:view');
  const job = await fetchJob(params.id);
  if (!job) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:p-0">
      <div className="print:hidden mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-yge-blue-900">
            DAS-140 — {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            Notice of Contract Award to Apprenticeship Committee.
            Hand-fill the committee details for each trade before
            mailing / faxing.
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="border border-gray-300 p-6 text-sm">
        <header className="mb-4 border-b-2 border-gray-900 pb-2">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            DAS-140 — Notice of Contract Award
          </h1>
          <p className="text-xs italic">
            (To Joint Apprenticeship Committee — California Department of
            Industrial Relations, Division of Apprenticeship Standards)
          </p>
        </header>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Contractor (Awarding Entity = signatory)
          </h2>
          <div className="mt-1 leading-snug">
            <div>
              <strong>{YGE_COMPANY_INFO.legalName}</strong>
            </div>
            <div>{YGE_COMPANY_INFO.address.street}</div>
            <div>
              {YGE_COMPANY_INFO.address.city},{' '}
              {YGE_COMPANY_INFO.address.state}{' '}
              {YGE_COMPANY_INFO.address.zip}
            </div>
            <div className="mt-1 text-xs text-gray-700">
              CSLB # {YGE_COMPANY_INFO.cslbLicense} · DIR Reg #{' '}
              {YGE_COMPANY_INFO.dirNumber}
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Project
          </h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-gray-600">Project name</dt>
              <dd>{job.projectName}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Location</dt>
              <dd>{job.location ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Awarding agency</dt>
              <dd>{job.ownerAgency ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Contract amount</dt>
              <dd className="font-mono">
                {job.engineersEstimateCents != null ? (
                  <Money cents={job.engineersEstimateCents} />
                ) : (
                  '__________________'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Estimated start</dt>
              <dd>__________________</dd>
            </div>
            <div>
              <dt className="text-gray-600">Estimated completion</dt>
              <dd>__________________</dd>
            </div>
          </dl>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Apprenticeship committees notified (one block per trade)
          </h2>
          {[1, 2, 3].map((n) => (
            <div key={n} className="mt-2 border border-dashed border-gray-400 p-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Trade / craft:</span>{' '}
                  ___________________________
                </div>
                <div>
                  <span className="text-gray-600">Committee name:</span>{' '}
                  ___________________________
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Address:</span>{' '}
                  __________________________________________________
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">City / state / zip:</span>{' '}
                  __________________________________________________
                </div>
                <div>
                  <span className="text-gray-600">Approx. # apprentices:</span>{' '}
                  ____
                </div>
                <div>
                  <span className="text-gray-600">Notify date:</span>{' '}
                  ____________
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-4 text-xs leading-snug">
          <p>
            The undersigned awarding entity certifies that, pursuant to
            California Labor Code §§ 1777.5 and 1777.7 and 8 CCR § 230,
            the joint apprenticeship committee(s) named above has been
            notified of the contract award referenced herein. Apprentice
            requests will be made via DAS-141 prior to the start of work
            for each apprenticeable craft.
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Authorized signature</div>
          </div>
          <div>
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Date</div>
          </div>
          <div className="col-span-2">
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Printed name + title</div>
          </div>
        </section>
      </article>

      <p className="mt-4 text-[11px] text-gray-500 print:mt-2">
        Generated {new Date().toISOString().slice(0, 16)} by YGE App. Mail
        a signed copy to each apprenticeship committee within 10 days of
        award; the DIR generally accepts faxed or emailed submissions
        as well.
      </p>
    </main>
  );
}
