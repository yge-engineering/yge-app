// Breadcrumbs — hierarchical nav for deep pages.
//
// Plain English: instead of "← Dashboard" on every back-link,
// show the trail you took: "Jobs › Sulphur Springs › Binder ›
// Photos" with each segment linkable. Useful on detail-of-detail
// pages like /jobs/[id]/binder, /estimates/[id]/sub-list, etc.

import Link from 'next/link';

export interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  trail: Crumb[];
}

export function Breadcrumbs({ trail }: Props) {
  if (trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-gray-500">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="text-blue-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? 'font-medium text-gray-900' : ''}>{c.label}</span>
              )}
              {!last ? <span className="text-gray-400" aria-hidden="true">›</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
