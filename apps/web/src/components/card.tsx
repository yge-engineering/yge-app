// Card + CardHeader — the dashboard-tile pattern, available everywhere.
//
// Plain English: a white panel with a thin gray border, light shadow,
// 16px padding. Title at the top with optional 'see all →' link. Used
// by the dashboard already; this exposes it for detail pages and
// future analytics views.

import Link from 'next/link';
import type React from 'react';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-gray-200 bg-white p-4 shadow-sm ${className ?? ''}`}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  /** Optional 'see all →' link. */
  href?: string;
  /** Optional right-side actions / chips. */
  right?: React.ReactNode;
}

export function CardHeader({ title, href, right }: CardHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="flex items-center gap-3 text-xs">
        {right}
        {href ? (
          <Link href={href} className="text-blue-700 hover:underline">
            see all &rarr;
          </Link>
        ) : null}
      </div>
    </div>
  );
}
