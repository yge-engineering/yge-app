import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — CPR pipeline by status.

import Link from 'next/link';
import type { CertifiedPayroll } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCprs(): Promise<CertifiedPayroll[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/certified-payrolls`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { cprs: CertifiedPayroll[] }).cprs;
  } catch {
    return [];
  }
}

async function CprStatusTileInner() {
  const cprs = await fetchCprs();
  if (cprs.length === 0) return null;

  const counts = {
    DRAFT: 0,
    SUBMITTED: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    AMENDED: 0,
  } as Record<string, number>;
  for (const c of cprs) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
  }

  // Rejected gets the most urgent treatment; submitted is the
  // bookkeeper's "waiting on" pile.
  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Certified payrolls — pipeline
        </h2>
        <Link
          href="/certified-payrolls"
          className="text-xs text-yge-blue-700 hover:underline"
        >
          Manage CPRs →
        </Link>
      </header>
      <div className="mt-3 grid grid-cols-5 gap-2">
        <Pill label="Draft" value={counts.DRAFT ?? 0} tone="neutral" />
        <Pill
          label="Submitted"
          value={counts.SUBMITTED ?? 0}
          tone="warn"
          hint="Waiting on agency review"
        />
        <Pill
          label="Accepted"
          value={counts.ACCEPTED ?? 0}
          tone="success"
        />
        <Pill
          label="Rejected"
          value={counts.REJECTED ?? 0}
          tone={(counts.REJECTED ?? 0) > 0 ? 'danger' : 'muted'}
          hint="Re-file with corrections"
        />
        <Pill
          label="Amended"
          value={counts.AMENDED ?? 0}
          tone="muted"
        />
      </div>
    </section>
  );
}

function Pill({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'warn' | 'success' | 'danger' | 'muted';
  hint?: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'danger'
          ? 'border-red-300 bg-red-50 text-red-900'
          : tone === 'muted'
            ? 'border-gray-200 bg-gray-50 text-gray-600'
            : 'border-gray-200 bg-white text-gray-800';
  return (
    <div
      className={`rounded border p-2 text-center ${toneClass}`}
      title={hint ?? ''}
    >
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 font-mono text-xl font-bold">{value}</div>
    </div>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function CprStatusTile(): Promise<React.ReactElement | null> {
  try {
    return await CprStatusTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[CprStatusTile] render failed:', err);
    return null;
  }
}

