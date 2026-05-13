// /jobs/[id]/pwc-100/print — California DIR Public Works Contract
// award notice (PWC-100). Required within 5 days of awarding a PW job.

import { notFound } from 'next/navigation';

import { Money } from '../../../../../components';
import type { Job } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { job: Job };
    return body.job;
  } catch {
    return null;
  }
}

export default async function Pwc100PrintPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-6 text-black print:max-w-none print:px-4 print:py-0">
      <header className="mb-4 border-b-2 border-gray-800 pb-2">
        <h1 className="text-xl font-bold">DIR PWC-100 — NOTICE OF AWARD</h1>
        <p className="text-sm">
          California Department of Industrial Relations · Public Works
          Contract Award Notification
        </p>
      </header>

      <section className="mb-4 text-sm">
        <p className="text-xs italic text-gray-700">
          File at: <span className="font-mono">https://www.dir.ca.gov/pwc100ext/</span> within
          5 working days of award. This form summarizes the award; submit
          electronic version via the DIR portal.
        </p>
      </section>

      <section className="mb-4 text-sm">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase">
          Awarding body / agency
        </h2>
        <p>{job.ownerAgency ?? '(Owner / agency not set on job)'}</p>
      </section>

      <section className="mb-4 text-sm">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase">
          Project
        </h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Project name</td>
              <td className="border border-gray-300 p-1">{job.projectName}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Project location</td>
              <td className="border border-gray-300 p-1">{job.location ?? '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Project type</td>
              <td className="border border-gray-300 p-1">{job.projectType}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Bid due</td>
              <td className="border border-gray-300 p-1">{job.bidDueDate ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-4 text-sm">
        <h2 className="mb-1 border-b border-gray-300 text-sm font-bold uppercase">
          Prime contractor (YGE)
        </h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Business name</td>
              <td className="border border-gray-300 p-1">Young General Engineering, Inc.</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Address</td>
              <td className="border border-gray-300 p-1">
                19645 Little Woods Rd, Cottonwood CA 96022
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">CSLB</td>
              <td className="border border-gray-300 p-1">1145219</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">DIR registration</td>
              <td className="border border-gray-300 p-1 font-mono">2000018967</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-1 font-semibold">Phone</td>
              <td className="border border-gray-300 p-1">707-499-7065 (Brook) · 707-599-9921 (Ryan)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 text-sm">
        <p>
          Awarding officer signature: ___________________________________
        </p>
        <p className="mt-4">Date: ______________________</p>
      </section>

      <footer className="mt-6 border-t border-gray-300 pt-2 text-[10px] text-gray-600">
        Reminder: filing the PWC-100 with DIR within 5 working days of
        award is a contractor requirement under California Labor Code
        §1773.3. Late filings may delay project start.
      </footer>
    </main>
  );
}
