// /search?q=... — global search across jobs, customers, vendors,
// employees.
//
// Plain English: a single text box hits this page. We fan out to the
// API, do a case-insensitive name match against every entity, and
// show grouped results.

import Link from 'next/link';

import { AppShell, Card, FORM_INPUT_CLASS, PageHeader } from '../../components';
import type { Customer, Employee, Job, Vendor } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function customerDisplay(c: Customer): string {
  // The shared/customer.ts has a customerDisplayName helper; fall back to
  // legalName/name fields the schema exposes directly.
  const anyC = c as unknown as { name?: string; legalName?: string };
  return anyC.name ?? anyC.legalName ?? c.id;
}

interface SearchPageProps {
  searchParams?: { q?: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = norm(searchParams?.q);

  const [jobs, customers, vendors, employees] = await Promise.all([
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<Customer>('/api/customers', 'customers'),
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<Employee>('/api/employees', 'employees'),
  ]);

  const jobMatches = q ? jobs.filter((j) => norm(j.projectName).includes(q) || norm(j.ownerAgency).includes(q)) : [];
  const customerMatches = q ? customers.filter((c) => norm(customerDisplay(c)).includes(q)) : [];
  const vendorMatches = q ? vendors.filter((v) => norm(v.legalName).includes(q)) : [];
  const employeeMatches = q ? employees.filter((e) => norm(`${e.firstName} ${e.lastName}`).includes(q)) : [];

  const totalMatches =
    jobMatches.length + customerMatches.length + vendorMatches.length + employeeMatches.length;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Search"
          subtitle={
            q ? (
              <>
                {totalMatches} result{totalMatches === 1 ? '' : 's'} for &ldquo;{q}&rdquo;
              </>
            ) : (
              'Type something below to search jobs, customers, vendors, and employees.'
            )
          }
        />
        <form action="/search" method="get" className="mb-6">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search jobs, customers, vendors, employees…"
            className={FORM_INPUT_CLASS}
            autoFocus
          />
        </form>

        {!q ? (
          <p className="text-sm text-gray-500">Type something above to search.</p>
        ) : totalMatches === 0 ? (
          <p className="text-sm text-gray-500">No matches.</p>
        ) : (
          <div className="space-y-6">
            {jobMatches.length > 0 && (
              <Section title={`Jobs (${jobMatches.length})`}>
                {jobMatches.map((j) => (
                  <ResultRow
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    title={j.projectName}
                    subtitle={`${j.ownerAgency ?? ''} · ${j.status}`}
                  />
                ))}
              </Section>
            )}
            {customerMatches.length > 0 && (
              <Section title={`Customers (${customerMatches.length})`}>
                {customerMatches.map((c) => (
                  <ResultRow key={c.id} href={`/customers/${c.id}`} title={customerDisplay(c)} subtitle="Customer" />
                ))}
              </Section>
            )}
            {vendorMatches.length > 0 && (
              <Section title={`Vendors (${vendorMatches.length})`}>
                {vendorMatches.map((v) => (
                  <ResultRow key={v.id} href={`/vendors/${v.id}`} title={v.legalName} subtitle={v.kind} />
                ))}
              </Section>
            )}
            {employeeMatches.length > 0 && (
              <Section title={`Employees (${employeeMatches.length})`}>
                {employeeMatches.map((e) => (
                  <ResultRow
                    key={e.id}
                    href={`/employees/${e.id}`}
                    title={`${e.firstName} ${e.lastName}`}
                    subtitle={`${e.role} · ${e.classification}`}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-gray-900">{title}</h2>
      <ul className="divide-y divide-gray-100">{children}</ul>
    </Card>
  );
}

function ResultRow({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <li>
      <Link href={href} className="block rounded px-2 py-2 -mx-2 hover:bg-gray-50">
        <div className="text-sm font-medium text-blue-700">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </Link>
    </li>
  );
}
