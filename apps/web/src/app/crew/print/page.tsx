// /crew/print — print-ready, emailable crew roster.
//
// Single-page foreman-grouped layout designed for "Print to PDF" and the
// "Email to foreman" mailto link. The mailto handler pre-fills the subject
// + body with a plain-text version of the roster so foremen who don't open
// the attachment still see the highlights.
//
// When the Outlook integration ships in Phase 3, this page is where the
// auto-send button lands; the underlying buildCrewRoster() output is the
// same shape that integration will consume.

import Link from 'next/link';
import {
  YGE_COMPANY_INFO,
  buildCrewRoster,
  certKindLabel,
  classificationLabel,
  coerceLocale,
  fullName,
  renderCrewRosterText,
  roleLabel,
  toolIdentifier,
  type Employee,
  type Tool,
} from '@yge/shared';
import { getTranslator } from '../../../lib/locale';
import { cookies } from 'next/headers';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { employees: Employee[] };
  return json.employees;
}

async function fetchTools(): Promise<Tool[]> {
  const res = await fetch(`${apiBaseUrl()}/api/tools`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { tools: Tool[] };
  return json.tools;
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function CrewPrintPage({
  searchParams,
}: {
  searchParams: { foreman?: string };
}) {
  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);
  const [employees, tools] = await Promise.all([fetchEmployees(), fetchTools()]);
  const fullRoster = buildCrewRoster({ employees, tools });

  // If the URL pins a foreman id, narrow to that group only — useful when
  // emailing one specific foreman just their crew + tool list.
  const foremanFilter = searchParams.foreman;
  const groups = foremanFilter
    ? fullRoster.groups.filter((g) => g.foreman?.id === foremanFilter)
    : fullRoster.groups;

  const company = YGE_COMPANY_INFO;
  const generatedDate = todayLong();
  const totalActive = groups.reduce((acc, g) => acc + g.members.length, 0);

  // Build the mailto link. When a single foreman is targeted, prefill their
  // email + a body containing the plain-text roster.
  const targetForeman =
    foremanFilter && groups.length === 1 ? groups[0]!.foreman : undefined;
  const emailRecipient = targetForeman?.email ?? '';
  const emailSubject = targetForeman
    ? `YGE crew + tools assigned to ${fullName(targetForeman)} \u2014 ${generatedDate}`
    : `YGE Crew Roster \u2014 ${generatedDate}`;
  const emailBody = renderCrewRosterText(
    { ...fullRoster, groups },
    { showTools: true, showCerts: true },
  );
  const mailto = `mailto:${encodeURIComponent(emailRecipient)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <>
      <style>{`
        @page { margin: 0.5in 0.5in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .group { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      <div className="no-print bg-gray-100 px-8 py-3 text-sm text-gray-700">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/crew" className="text-yge-blue-500 hover:underline">
              {t('newEmployee.back')}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={mailto}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
              title={t('crewPrint.emailTooltip')}
            >
              {t('crewPrint.emailTo', { name: targetForeman ? fullName(targetForeman) : t('crewPrint.foremanWord') })}
            </a>
            <PrintButton />
          </div>
        </div>
        {!foremanFilter && fullRoster.groups.some((g) => g.foreman) && (
          <div className="mx-auto mt-2 max-w-5xl text-xs text-gray-600">
            {t('crewPrint.filterPrompt')}{' '}
            {fullRoster.groups
              .filter((g) => g.foreman)
              .map((g, i, arr) => (
                <span key={g.id}>
                  <Link
                    href={`/crew/print?foreman=${g.foreman!.id}`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    {fullName(g.foreman!)}
                  </Link>
                  {i < arr.length - 1 ? ' \u00b7 ' : ''}
                </span>
              ))}
          </div>
        )}
      </div>

      <main className="mx-auto max-w-5xl bg-white px-10 py-8 text-gray-900">
        <Letterhead
          variant="compact"
          rightBlock={
            <>
              <div className="font-semibold uppercase tracking-wide">
                {t('crewPrint.docTitle')}
              </div>
              <div>{generatedDate}</div>
              <div>
                {t('crewPrint.activeInactive', { active: totalActive, inactive: fullRoster.totalInactive })}
              </div>
            </>
          }
        />

        {fullRoster.expiredCertCount > 0 && !foremanFilter && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {fullRoster.expiringSoonCertCount > 0
              ? t('crewPrint.expiredPlus', { expired: fullRoster.expiredCertCount, soon: fullRoster.expiringSoonCertCount })
              : t('crewPrint.expiredOnly', { expired: fullRoster.expiredCertCount })}
          </div>
        )}

        {groups.length === 0 && (
          <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            {foremanFilter
              ? t('crewPrint.noCrewForeman')
              : t('crewPrint.noEmployees')}
          </div>
        )}

        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.id} className="group">
              <h2 className="border-b border-gray-300 pb-1 text-lg font-semibold text-yge-blue-700">
                {group.label}
              </h2>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1 pr-4">{t('crewPrint.thName')}</th>
                    <th className="py-1 pr-4">{t('crewPrint.thRole')}</th>
                    <th className="py-1 pr-4">{t('crewPrint.thPhone')}</th>
                    <th className="py-1 pr-4">{t('crewPrint.thClassification')}</th>
                    <th className="py-1 pr-4">{t('crewPrint.thCerts')}</th>
                    <th className="py-1">{t('crewPrint.thToolsOut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.members.map((m) => {
                    const e = m.employee;
                    return (
                      <tr key={e.id} className={m.anyExpired ? 'bg-red-50' : ''}>
                        <td className="py-2 pr-4 align-top font-medium">
                          {fullName(e)}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-gray-600">
                          {roleLabel(e.role, locale)}
                        </td>
                        <td className="py-2 pr-4 align-top text-gray-700">
                          {e.phone ?? ''}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-gray-600">
                          {classificationLabel(e.classification, locale)}
                        </td>
                        <td className="py-2 pr-4 align-top text-xs text-gray-700">
                          {m.certs.length === 0 ? (
                            <span className="text-gray-400">&mdash;</span>
                          ) : (
                            <ul>
                              {m.certs.map((c, i) => (
                                <li
                                  key={i}
                                  className={
                                    c.status === 'expired'
                                      ? 'font-semibold text-red-700'
                                      : c.status === 'expiringSoon'
                                        ? 'font-semibold text-yellow-700'
                                        : ''
                                  }
                                >
                                  {certKindLabel(c.cert.kind, locale)}
                                  {c.cert.expiresOn && (
                                    <> &middot; {c.cert.expiresOn}</>
                                  )}
                                  {c.status === 'expired' && ' ' + t('crewPrint.expiredSuffix')}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2 align-top text-xs text-gray-700">
                          {m.tools.length === 0 ? (
                            <span className="text-gray-400">&mdash;</span>
                          ) : (
                            <ul>
                              {m.tools.map((t) => (
                                <li key={t.id}>{toolIdentifier(t)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-3 text-xs text-gray-500">
          {t('crewPrint.footer', { date: generatedDate, name: company.legalName, addr: `${company.address.street}, ${company.address.city}, ${company.address.state} ${company.address.zip}` })}
        </footer>
      </main>
    </>
  );
}
