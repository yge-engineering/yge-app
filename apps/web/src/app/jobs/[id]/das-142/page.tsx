// /jobs/[id]/das-142 — Training Fund Contributions.

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

export default async function Das142Page({
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
            DAS-142 — {job.projectName}
          </h1>
          <p className="text-xs text-gray-600">
            Training Fund Contributions report. File with the
            California Apprenticeship Council quarterly per § 1777.5(m).
          </p>
        </div>
        <PrintButton />
      </div>

      <article className="border border-gray-300 p-6 text-sm">
        <header className="mb-4 border-b-2 border-gray-900 pb-2">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            DAS-142 — Training Fund Contributions
          </h1>
          <p className="text-xs italic">
            (California Apprenticeship Council — § 1777.5(m))
          </p>
        </header>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Contractor
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
            Project + reporting period
          </h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-gray-600">Project name</dt>
              <dd>{job.projectName}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Awarding agency</dt>
              <dd>{job.ownerAgency ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Project location</dt>
              <dd>{job.location ?? '—'}</dd>
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
              <dt className="text-gray-600">Reporting quarter</dt>
              <dd>Q__ — Year ______</dd>
            </div>
            <div>
              <dt className="text-gray-600">Date submitted</dt>
              <dd>__________________</dd>
            </div>
          </dl>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide">
            Contributions by trade
          </h2>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-900">
                <th className="px-1 py-1 text-left">Trade / craft</th>
                <th className="px-1 py-1 text-right">Total hours</th>
                <th className="px-1 py-1 text-right">Apprentice hrs</th>
                <th className="px-1 py-1 text-right">Rate / hr</th>
                <th className="px-1 py-1 text-right">Contribution</th>
                <th className="px-1 py-1 text-left">Trust fund / CAC</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <tr key={n} className="border-b border-gray-200">
                  <td className="px-1 py-2">_______________________</td>
                  <td className="px-1 py-2 text-right">______</td>
                  <td className="px-1 py-2 text-right">______</td>
                  <td className="px-1 py-2 text-right">$ ______</td>
                  <td className="px-1 py-2 text-right">$ ______</td>
                  <td className="px-1 py-2">_______________________</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900 bg-gray-50">
                <td colSpan={4} className="px-1 py-2 text-right font-semibold">
                  Total contributions for quarter
                </td>
                <td className="px-1 py-2 text-right font-mono font-semibold">
                  $ ____________
                </td>
                <td className="px-1 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="mb-4 text-xs leading-snug">
          <p>
            I certify under penalty of perjury under the laws of the
            State of California that the foregoing is true and correct,
            that the contributions reported above were made (or are
            being made) to the named apprenticeship trust fund(s) (or
            in lieu of, to the California Apprenticeship Council) per
            Labor Code § 1777.5(m), and that the apprentice ratios
            required by § 1777.5(g) were met for the quarter reported.
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
        Generated {new Date().toISOString().slice(0, 16)} by YGE App.
        Mail / fax to the California Apprenticeship Council, 1515 Clay
        St., 11th Floor, Oakland, CA 94612 quarterly.
      </p>
    </main>
  );
}
