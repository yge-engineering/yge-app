// /jobs/[id]/das-141 — Request for Dispatch of Apprentices.

import { notFound } from 'next/navigation';

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

export default async function Das141Page({
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
            DAS-141 — {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            Request for Dispatch of Apprentices. Send to the joint
            apprenticeship committee at least 72 hours before work
            starts (excluding weekends + state holidays).
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="border border-gray-300 p-6 text-sm">
        <header className="mb-4 border-b-2 border-gray-900 pb-2">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            DAS-141 — Request for Dispatch of Apprentices
          </h1>
          <p className="text-xs italic">
            Per California Labor Code § 1777.5 and 8 CCR § 230.1
          </p>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <h2 className="font-semibold uppercase tracking-wide">From</h2>
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
              <div className="mt-1 text-gray-700">
                CSLB # {YGE_COMPANY_INFO.cslbLicense} · DIR Reg #{' '}
                {YGE_COMPANY_INFO.dirNumber}
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-semibold uppercase tracking-wide">To</h2>
            <div className="mt-1 leading-snug text-gray-600">
              Apprenticeship committee:{' '}
              ____________________________________
              <br />
              Trade / craft:{' '}
              ____________________________________
              <br />
              Address:{' '}
              ____________________________________
              <br />
              City / state / zip:{' '}
              ____________________________________
              <br />
              Phone / fax:{' '}
              ____________________________________
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Project / dispatch details
          </h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-gray-600">Project name</dt>
              <dd>{job.projectName}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Project location</dt>
              <dd>{job.location ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Awarding agency</dt>
              <dd>{job.ownerAgency ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Trade / craft requested</dt>
              <dd>______________________________</dd>
            </div>
            <div>
              <dt className="text-gray-600"># Apprentices needed</dt>
              <dd>______________________________</dd>
            </div>
            <div>
              <dt className="text-gray-600">Date apprentices needed</dt>
              <dd>______________________________</dd>
            </div>
            <div>
              <dt className="text-gray-600">Anticipated duration (weeks)</dt>
              <dd>______________________________</dd>
            </div>
            <div>
              <dt className="text-gray-600">Estimated work hours</dt>
              <dd>______________________________</dd>
            </div>
          </dl>
        </section>

        <section className="mb-4 text-xs leading-snug">
          <p>
            We are requesting the dispatch of the apprentice(s) listed
            above for the project named. Please confirm dispatch and
            provide the apprentice(s)' contact information at your
            earliest convenience. If your committee is unable to dispatch
            within 72 hours (excluding weekends and state holidays), we
            understand we may employ apprentices from another committee
            or proceed with journey-level workers per 8 CCR § 230.1(a).
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Signature (contractor representative)</div>
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
        Generated {new Date().toISOString().slice(0, 16)} by YGE App.
      </p>
    </main>
  );
}
