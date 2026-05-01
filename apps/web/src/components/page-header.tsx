// PageHeader — the common header pattern used by every list/detail
// page.
//
// Plain English: replaces the '← Dashboard' link + h1 title + p
// subtitle + right-side action button cluster that every page
// hand-rolls today. Drop in <PageHeader title="…"> and you get a
// consistent layout.

import Link from 'next/link';
import type React from 'react';

interface BreadcrumbLink {
  href: string;
  label: string;
}

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  /** Default '← Dashboard'. Pass null to hide. */
  back?: BreadcrumbLink | null;
  /** Right-aligned action buttons / links. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, back, actions }: Props) {
  const backLink = back === null ? null : back ?? { href: '/dashboard', label: '← Dashboard' };
  return (
    <header className="mb-6">
      {backLink ? (
        <div className="mb-3 text-sm">
          <Link href={backLink.href} className="text-blue-700 hover:underline">
            {backLink.label}
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
