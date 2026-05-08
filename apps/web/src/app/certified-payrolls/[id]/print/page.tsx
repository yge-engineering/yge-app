// /certified-payrolls/[id]/print — printable CPR layout.
//
// Browser-print to PDF. Top header has payer/project metadata, then
// a wide table of employee rows with daily hours + classification +
// straight/OT/gross/deductions/net. Compliance statement at the
// bottom for the officer to sign.

import { notFound } from 'next/navigation';

import { Money } from '../../../../components/money';
import { requirePermission } from '../../../../lib/permissions';
import { PrintButton } from '../../../../components/print-button';
import {
  type CertifiedPayroll,
  type Job,
  YGE_COMPANY_INFO,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCpr(id: string): Promise<CertifiedPayroll | null> {
  try {
    const res = await fetch(
      `${apiBaseUrl()}/api/certified-payrolls/${encodeURIComponent(id)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { cpr?: CertifiedPayroll };
    return body.cpr ?? null;
  } catch {
    return null;
  }
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { job?: Job };
    return body.job ?? null;
  } catch {
    return null;
  }
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function CprPrintPage({
  params,
}: {
  params: { id: string };
}) {
  requirePermission('financials:view');
  const cpr = await fetchCpr(params.id);
  if (!cpr) notFound();
  const job = cpr.jobId ? await fetchJob(cpr.jobId) : null;

  // Roll-up totals for the footer.
  let totalStraight = 0;
  let totalOt = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  for (const r of cpr.rows) {
    totalStraight += r.straightHours;
    totalOt += r.overtimeHours;
    totalGross += r.grossPayCents;
    totalDeductions += r.deductionsCents;
    totalNet += r.netPayCents;
  }

  return (
    <main className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
      <div className="print:hidden mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-yge-blue-900">
            Certified payroll #{cpr.payrollNumber}
          </h1>
          <p className="text-xs text-gray-600">
            Week of {cpr.weekStarting} → {cpr.weekEnding}
            {cpr.isFinalPayroll ? ' · FINAL PAYROLL' : ''}
          </p>
        </div>
        <PrintButton />
      </div>

      <header className="border-b-2 border-gray-900 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold">
            CERTIFIED PAYROLL — {cpr.weekStarting} to {cpr.weekEnding}
          </h1>
          <span className="font-mono text-xs">
            Payroll #{cpr.payrollNumber}
            {cpr.isFinalPayroll ? ' · FINAL' : ''}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 text-xs">
          <div>
            <dt className="text-gray-600">Contractor</dt>
            <dd>
              {YGE_COMPANY_INFO.legalName} · CSLB{' '}
              {YGE_COMPANY_INFO.cslbLicense} · DIR{' '}
              {YGE_COMPANY_INFO.dirNumber}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Project</dt>
            <dd>
              {job?.projectName ?? '—'} ·{' '}
              {cpr.projectNumber ? `#${cpr.projectNumber}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Awarding agency</dt>
            <dd>{cpr.awardingAgency ?? job?.ownerAgency ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Project location</dt>
            <dd>{job?.location ?? '—'}</dd>
          </div>
        </dl>
      </header>

      {cpr.rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">No employee rows on this CPR yet.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="px-1 py-1 text-left">Employee</th>
              <th className="px-1 py-1 text-left">Classification</th>
              {DAY_LABELS.map((d) => (
                <th key={d} className="px-1 py-1 text-right">
                  {d}
                </th>
              ))}
              <th className="px-1 py-1 text-right">ST</th>
              <th className="px-1 py-1 text-right">OT</th>
              <th className="px-1 py-1 text-right">Rate</th>
              <th className="px-1 py-1 text-right">Fringe</th>
              <th className="px-1 py-1 text-right">Gross</th>
              <th className="px-1 py-1 text-right">Deduc.</th>
              <th className="px-1 py-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {cpr.rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-1 py-1">
                  {r.name}
                  {r.ssnLast4 ? (
                    <span className="ml-1 text-gray-500">
                      (xxx-xx-{r.ssnLast4})
                    </span>
                  ) : null}
                </td>
                <td className="px-1 py-1">
                  {r.classificationOverride ?? r.classification}
                </td>
                {r.dailyHours.map((h, j) => (
                  <td key={j} className="px-1 py-1 text-right font-mono">
                    {h > 0 ? h.toFixed(2) : ''}
                  </td>
                ))}
                <td className="px-1 py-1 text-right font-mono">
                  {r.straightHours.toFixed(2)}
                </td>
                <td className="px-1 py-1 text-right font-mono">
                  {r.overtimeHours > 0 ? r.overtimeHours.toFixed(2) : ''}
                </td>
                <td className="px-1 py-1 text-right font-mono">
                  ${(r.hourlyRateCents / 100).toFixed(2)}
                </td>
                <td className="px-1 py-1 text-right font-mono">
                  ${(r.fringeRateCents / 100).toFixed(2)}
                </td>
                <td className="px-1 py-1 text-right font-mono">
                  <Money cents={r.grossPayCents} />
                </td>
                <td className="px-1 py-1 text-right font-mono">
                  <Money cents={r.deductionsCents} />
                </td>
                <td className="px-1 py-1 text-right font-mono font-semibold">
                  <Money cents={r.netPayCents} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900 bg-gray-50">
              <td colSpan={9} className="px-1 py-2 text-right font-semibold">
                Totals
              </td>
              <td className="px-1 py-2 text-right font-mono font-semibold">
                {totalStraight.toFixed(2)}
              </td>
              <td className="px-1 py-2 text-right font-mono font-semibold">
                {totalOt.toFixed(2)}
              </td>
              <td colSpan={2} className="px-1 py-2"></td>
              <td className="px-1 py-2 text-right font-mono font-semibold">
                <Money cents={totalGross} />
              </td>
              <td className="px-1 py-2 text-right font-mono font-semibold">
                <Money cents={totalDeductions} />
              </td>
              <td className="px-1 py-2 text-right font-mono font-semibold">
                <Money cents={totalNet} />
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <section className="mt-6 break-inside-avoid border border-gray-300 p-3 text-xs">
        <h2 className="font-semibold">Statement of Compliance</h2>
        <p className="mt-1 leading-snug">
          I, ____________________________, do hereby state that I pay or
          supervise the payment of the persons employed by{' '}
          {YGE_COMPANY_INFO.legalName} on the project described above; that
          during the payroll period commencing on {cpr.weekStarting} and
          ending on {cpr.weekEnding}, all persons employed on said project
          have been paid the full weekly wages earned, that no rebates have
          been or will be made directly or indirectly to or on behalf of
          said {YGE_COMPANY_INFO.legalName} from the full weekly wages
          earned by any person, and that no deductions have been made
          either directly or indirectly from the full wages earned by any
          person other than permissible deductions as defined in
          regulations issued by the Secretary of Labor under the
          Copeland Act (29 CFR Part 3).
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Signature</div>
          </div>
          <div>
            <div className="border-b border-gray-700 pb-3"></div>
            <div className="mt-1">Date</div>
          </div>
        </div>
      </section>

      {cpr.notes ? (
        <p className="mt-4 text-xs text-gray-700">
          <strong>Notes:</strong> {cpr.notes}
        </p>
      ) : null}

      <p className="mt-6 text-[11px] text-gray-500 print:mt-3">
        Generated {new Date().toISOString().slice(0, 16)} by YGE App. This
        layout follows the data fields the DIR A-1-131 / federal WH-347
        forms require. For agencies that demand the official PDF
        template, fill it from this data via the PDF-form filler in the
        master profile editor.
      </p>
    </main>
  );
}
