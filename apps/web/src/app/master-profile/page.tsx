// /master-profile — single-source-of-truth identity record.
//
// Read view shows every field; the inline editor below it PATCHes
// /api/master-profile. The PDF form filler, browser auto-form-fill
// extension, ACORD 25 generator, and every agency form template
// resolve fields against this record.

import Link from 'next/link';
import {
  Alert,
  AppShell,
  AuditBinderPanel,
  PageHeader,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import { MasterProfileEditor } from '@/components/master-profile-editor';
import { MasterProfileOfficersEditor } from '@/components/master-profile-officers-editor';
import { MasterProfileInsuranceEditor } from '@/components/master-profile-insurance-editor';
import { MasterProfileBondingEditor } from '@/components/master-profile-bonding-editor';
import type { MasterProfile } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MasterProfile }).profile;
  } catch { return null; }
}

export default async function MasterProfilePage() {
  const profile = await fetchProfile();
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link href="/pdf-forms" className="text-sm text-yge-blue-500 hover:underline">
            PDF form library →
          </Link>
        </div>

        <PageHeader
          title={t('master.profile.title')}
          subtitle={t('master.profile.subtitle')}
        />

        {!profile ? (
          <Alert tone="danger" className="mt-6" title={t('master.profile.fetchError.title')}>
            {t('master.profile.fetchError.body')}
          </Alert>
        ) : (
          <>
            <Section title={t('master.profile.identity')}>
              <Row label="Legal name" value={profile.legalName} />
              <Row label="Short name" value={profile.shortName} />
              <Row label="CSLB license" value={profile.cslbLicense} />
              <Row
                label="CSLB classifications"
                value={profile.cslbClassifications.join(', ') || '—'}
              />
              <Row label="CSLB expires" value={profile.cslbExpiresOn ?? '—'} />
              <Row label="DIR registration" value={profile.dirNumber} />
              <Row label="DIR expires" value={profile.dirExpiresOn ?? '—'} />
              <Row label="DOT" value={profile.dotNumber ?? '—'} />
              <Row label="CA MCP" value={profile.caMcpNumber ?? '—'} />
              <Row label="Federal EIN" value={profile.federalEin ?? '—'} />
              <Row label="CA SOS entity #" value={profile.caEntityNumber ?? '—'} />
              <Row label="CA employer account" value={profile.caEmployerAccountNumber ?? '—'} />
              <Row label="NAICS" value={profile.naicsCodes.join(', ')} />
              <Row label="PSC" value={profile.pscCodes.join(', ')} />
            </Section>

            <Section title={t('master.profile.address')}>
              <Row label="Street" value={profile.address.street} />
              {profile.address.street2 && <Row label="Suite / unit" value={profile.address.street2} />}
              <Row label="City" value={profile.address.city} />
              <Row label="State" value={profile.address.state} />
              <Row label="ZIP" value={profile.address.zip} />
              <Row label="County" value={profile.address.county ?? '—'} />
              <Row label="Phone" value={profile.primaryPhone} />
              {profile.primaryFax && <Row label="Fax" value={profile.primaryFax} />}
              <Row label="Email" value={profile.primaryEmail} />
              {profile.websiteUrl && <Row label="Website" value={profile.websiteUrl} />}
            </Section>

            <Section title={`${t('master.profile.officers')} (${profile.officers.length})`}>
              {profile.officers.length === 0 ? (
                <p className="text-sm text-gray-500">No officers recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-1 text-left">Name</th>
                      <th className="py-1 text-left">Title</th>
                      <th className="py-1 text-left">Role key</th>
                      <th className="py-1 text-left">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.officers.map((o) => (
                      <tr key={o.id}>
                        <td className="py-1.5 font-medium text-gray-900">{o.name}</td>
                        <td className="py-1.5 text-gray-700">{o.title}</td>
                        <td className="py-1.5 font-mono text-xs text-gray-600">{o.roleKey}</td>
                        <td className="py-1.5 text-gray-700">{o.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={t('master.profile.bonding')}>
              {!profile.bonding ? (
                <p className="text-sm text-gray-500">
                  No bonding profile recorded. Add one to enable bonding-capacity
                  checks in the bid coach.
                </p>
              ) : (
                <>
                  <Row label="Surety" value={profile.bonding.suretyName} />
                  <Row
                    label="Single-job limit"
                    value={`$${(profile.bonding.singleJobLimitCents / 100).toLocaleString()}`}
                  />
                  <Row
                    label="Aggregate limit"
                    value={`$${(profile.bonding.aggregateLimitCents / 100).toLocaleString()}`}
                  />
                  {profile.bonding.agentName && <Row label="Agent" value={profile.bonding.agentName} />}
                </>
              )}
            </Section>

            <Section title={`${t('master.profile.insurance')} (${profile.insurance.length})`}>
              {profile.insurance.length === 0 ? (
                <p className="text-sm text-gray-500">No insurance policies recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-1 text-left">Kind</th>
                      <th className="py-1 text-left">Carrier</th>
                      <th className="py-1 text-left">Policy #</th>
                      <th className="py-1 text-left">Expires</th>
                      <th className="py-1 text-right">Per occurrence</th>
                      <th className="py-1 text-right">Aggregate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profile.insurance.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 font-mono text-xs text-gray-600">{p.kind}</td>
                        <td className="py-1.5 text-gray-700">{p.carrierName}</td>
                        <td className="py-1.5 font-mono text-xs">{p.policyNumber}</td>
                        <td className="py-1.5 font-mono text-xs">{p.expiresOn}</td>
                        <td className="py-1.5 text-right font-mono text-xs">
                          ${(p.perOccurrenceCents / 100).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right font-mono text-xs">
                          ${(p.aggregateCents / 100).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={t('master.profile.diversity')}>
              <Row label="DBE" value={profile.isDbe ? 'Yes' : 'No'} />
              <Row label="SBE" value={profile.isSbe ? 'Yes' : 'No'} />
              <Row label="DVBE" value={profile.isDvbe ? 'Yes' : 'No'} />
              <Row label="WBE" value={profile.isWbe ? 'Yes' : 'No'} />
            </Section>

            <div className="mt-8">
              <MasterProfileEditor apiBaseUrl={publicApiBaseUrl()} initial={profile} />
            </div>

            <div className="mt-6">
              <MasterProfileOfficersEditor apiBaseUrl={publicApiBaseUrl()} initial={profile.officers} />
            </div>

            <div className="mt-6">
              <MasterProfileBondingEditor apiBaseUrl={publicApiBaseUrl()} initial={profile.bonding} />
            </div>

            <div className="mt-6">
              <MasterProfileInsuranceEditor apiBaseUrl={publicApiBaseUrl()} initial={profile.insurance} />
            </div>

            <AuditBinderPanel entityType="Company" entityId={profile.id} />
          </>
        )}
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2 text-gray-900">{value}</dd>
    </div>
  );
}
