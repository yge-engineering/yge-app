// /incidents/300a/[year] — printable Form 300A Annual Summary.

import Link from 'next/link';
import { computeForm300A, type Incident } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchAll(): Promise<Incident[]> {
  const res = await fetch(`${apiBaseUrl()}/api/incidents`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { incidents: Incident[] }).incidents;
}

export default async function Form300APage({
  params,
}: {
  params: { year: string };
}) {
  const year = /^\d{4}$/.test(params.year) ? Number(params.year) : new Date().getFullYear();
  const all = await fetchAll();
  const summary = computeForm300A(all, year);

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/incidents?year=${year}`} className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back
        </Link>
        <span className="text-xs text-gray-500">Use your browser's Print menu (Ctrl/Cmd+P)</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <header className="mb-4 text-center">
          <h1 className="text-lg font-bold uppercase">
            OSHA's Form 300A
          </h1>
          <p className="text-xs">
            Summary of Work-Related Injuries and Illnesses — Year {summary.year}
          </p>
        </header>

        <p className="mb-4 rounded border border-gray-400 p-2 text-[10px]">
          All establishments covered by Part 1904 must complete this Summary
          page, even if no injuries or illnesses occurred during the year.
          Remember to review the Log to verify that the entries are complete
          and accurate before completing this summary. Post this Summary page
          from February 1 to April 30 of the year following the year covered
          by the form.
        </p>

        <Block title="Establishment information">
          <Grid>
            <Field label="Establishment name">Young General Engineering, Inc.</Field>
            <Field label="Address">19645 Little Woods Rd</Field>
            <Field label="City / State / ZIP">Cottonwood, CA 96022</Field>
            <Field label="Industry / NAICS">Heavy civil — 115310</Field>
          </Grid>
        </Block>

        <Block title="Number of cases">
          <Grid>
            <NumField label="Total number of deaths (G)" value={summary.totalDeaths} />
            <NumField label="Total cases with days away from work (H)" value={summary.totalDaysAwayCases} />
            <NumField label="Total cases with job transfer or restriction (I)" value={summary.totalRestrictedCases} />
            <NumField label="Total other recordable cases (J)" value={summary.totalOtherRecordableCases} />
          </Grid>
        </Block>

        <Block title="Number of days">
          <Grid>
            <NumField label="Total number of days away from work (K)" value={summary.totalDaysAway} />
            <NumField label="Total number of days of job transfer or restriction (L)" value={summary.totalDaysRestricted} />
          </Grid>
        </Block>

        <Block title="Injury and illness types">
          <Grid>
            <NumField label="Injuries (M.1)" value={summary.byClassification.injuries} />
            <NumField label="Skin disorders (M.2)" value={summary.byClassification.skinDisorders} />
            <NumField label="Respiratory conditions (M.3)" value={summary.byClassification.respiratoryConditions} />
            <NumField label="Poisonings (M.4)" value={summary.byClassification.poisonings} />
            <NumField label="Hearing loss (M.5)" value={summary.byClassification.hearingLoss} />
            <NumField label="All other illnesses (M.6)" value={summary.byClassification.allOtherIllnesses} />
          </Grid>
        </Block>

        <p className="mt-6 text-xs">
          <strong>Sign here.</strong> I certify that I have examined this
          document and that to the best of my knowledge the entries are true,
          accurate, and complete.
        </p>

        <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="font-semibold uppercase">Executive's name</div>
            <div className="mt-1 border-b border-gray-400 pb-1">Ryan D. Young</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Title</div>
            <div className="mt-1 border-b border-gray-400 pb-1">Vice President / Safety Director</div>
          </div>
          <div>
            <div className="font-semibold uppercase">Date</div>
            <div className="mt-1 border-b border-gray-400 pb-1">&nbsp;</div>
          </div>
        </div>

        <p className="mt-6 text-[10px] italic text-gray-600">
          Required under federal regulation 29 CFR 1904.32 and California Code
          of Regulations Title 8 §14300.32. Post in a visible location from
          February 1 to April 30, {summary.year + 1}.
        </p>
      </article>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
        {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 text-xs">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-gray-700">{label}</div>
      <div className="mt-0.5 border-b border-gray-400 pb-0.5 text-sm">{children}</div>
    </div>
  );
}

function NumField({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-gray-300 px-2 py-1">
      <span className="text-[10px] font-semibold uppercase text-gray-700">
        {label}
      </span>
      <span className="font-mono text-base font-bold">{value}</span>
    </div>
  );
}
