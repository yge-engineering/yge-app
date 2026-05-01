// Getting-started banner — shown on the dashboard when the company has
// no data yet (zero customers, zero jobs, zero employees).
//
// Plain English: "you just signed in, here's what to do first" — keeps
// new users from staring at a wall of zeros and feeling lost.

import Link from 'next/link';

interface Props {
  customers: number;
  jobs: number;
  employees: number;
}

export function GettingStartedBanner({ customers, jobs, employees }: Props) {
  // Only show if everything is empty.
  if (customers > 0 || jobs > 0 || employees > 0) return null;

  return (
    <div className="mb-6 rounded-md border border-blue-300 bg-blue-50 p-5">
      <h2 className="text-base font-semibold text-blue-900">Welcome — let&apos;s get the basics in.</h2>
      <p className="mt-1 text-sm text-blue-900/90">
        The dashboard fills in once you have a few records. Knock these out in any order:
      </p>
      <ol className="mt-3 space-y-2 text-sm text-blue-900">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">1</span>
          <div>
            <Link href="/customers/new" className="font-semibold underline hover:no-underline">
              Add your first customer
            </Link>
            <span className="block text-xs text-blue-900/70">
              Caltrans, your county, the agencies you bid on — and any private clients.
            </span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">2</span>
          <div>
            <Link href="/employees/new" className="font-semibold underline hover:no-underline">
              Add your crew
            </Link>
            <span className="block text-xs text-blue-900/70">
              Foremen, operators, laborers. Picks the DIR classification used for prevailing wage.
            </span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">3</span>
          <div>
            <Link href="/jobs/new" className="font-semibold underline hover:no-underline">
              Create your first job
            </Link>
            <span className="block text-xs text-blue-900/70">
              A pursuit (something you&apos;re bidding on) or an active job. Start here for the Sulphur Springs bid.
            </span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">4</span>
          <div>
            <Link href="/help" className="font-semibold underline hover:no-underline">
              Skim the help page
            </Link>
            <span className="block text-xs text-blue-900/70">
              4 how-tos for the most common workflows. Bookmark it for the first month.
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}
