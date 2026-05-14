import { AppShell, PageHeader } from '../../components';

export default function AboutPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="About this app" subtitle="What it is and who runs it." />

        <section className="space-y-4 text-sm leading-6 text-gray-800">
          <p>
            The YGE app is a bookkeeping, estimating, and job-management platform built for{' '}
            <span className="font-semibold">Young General Engineering, Inc.</span>, a heavy-civil contractor
            in Cottonwood, California. It replaces a sprawl of Excel sheets and a separate accounting tool
            with one source of truth for jobs, estimates, bids, vendors, employees, and field reporting.
          </p>

          <h2 className="mt-4 text-base font-semibold text-gray-900">Company</h2>
          <ul className="list-disc pl-6">
            <li>President: Brook L. Young — 707-499-7065 — brookyoung@youngge.com</li>
            <li>Vice President: Ryan D. Young — 707-599-9921 — ryoung@youngge.com</li>
            <li>Address: 19645 Little Woods Rd, Cottonwood CA 96022</li>
          </ul>

          <h2 className="mt-4 text-base font-semibold text-gray-900">Licensing</h2>
          <ul className="list-disc pl-6">
            <li>CSLB 1145219</li>
            <li>DIR 2000018967</li>
            <li>DOT 4528204</li>
            <li>NAICS 115310 · PSC F003, F004</li>
          </ul>

          <h2 className="mt-4 text-base font-semibold text-gray-900">Disciplines</h2>
          <p>
            Heavy civil and public-works construction, prevailing-wage and private-rate projects,
            CAL FIRE / Caltrans / DIR / county-agency work, and bondable contracts.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
