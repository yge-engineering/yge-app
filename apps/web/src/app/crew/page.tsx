// /crew — full active roster, foreman-grouped.
//
// Server component: fetches employees + tools, builds the foreman-grouped
// roster on the server, renders one card per group. Actions in the toolbar
// link to /crew/new and /crew/print (the emailable version).

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import { getTranslator } from '../../lib/locale';
import {
  buildCrewRoster,
  certKindLabel,
  classificationLabel,
  fullName,
  roleLabel,
  toolIdentifier,
  type Employee,
  type Tool,
} from '@yge/shared';

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

export default async function CrewPage() {
  const [employees, tools] = await Promise.all([fetchEmployees(), fetchTools()]);
  const roster = buildCrewRoster({ employees, tools });
  const t = getTranslator();

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/tools" className="text-yge-blue-500 hover:underline">
            {t('crew.toolsLink')}
          </Link>
          <Link
            href="/crew/print"
            className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            {t('crew.printRoster')}
          </Link>
          <Link
            href="/crew/new"
            className="rounded bg-yge-blue-500 px-3 py-1 font-medium text-white hover:bg-yge-blue-700"
          >
            {t('crew.addEmployee')}
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('crew.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('crew.subtitle', { active: roster.totalActive, inactive: roster.totalInactive })}
        {roster.expiredCertCount > 0 && (
          <span className="ml-3 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
            {t('crew.expiredBadge', { count: roster.expiredCertCount, plural: roster.expiredCertCount === 1 ? '' : 's' })}
          </span>
        )}
        {roster.expiringSoonCertCount > 0 && (
          <span className="ml-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
            {t('crew.expiringSoonBadge', { count: roster.expiringSoonCertCount })}
          </span>
        )}
      </p>

      {roster.groups.length === 0 && (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {t('crew.empty')}
        </div>
      )}

      <div className="mt-8 space-y-8">
        {roster.groups.map((group) => (
          <section
            key={group.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <header className="border-b border-gray-200 bg-gray-50 px-5 py-3">
              <h2 className="text-lg font-semibold text-yge-blue-700">
                {group.label}
              </h2>
              <p className="text-xs text-gray-500">
                {t('crew.foreman.people', {
                  count: group.members.length,
                  label: group.members.length === 1 ? t('crew.foreman.person') : t('crew.foreman.peopleWord'),
                })}
              </p>
            </header>
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2">{t('crew.col.nameRole')}</th>
                  <th className="px-5 py-2">{t('crew.col.phone')}</th>
                  <th className="px-5 py-2">{t('crew.col.classification')}</th>
                  <th className="px-5 py-2">{t('crew.col.certs')}</th>
                  <th className="px-5 py-2">{t('crew.col.toolsOut')}</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.members.map((m) => {
                  const e = m.employee;
                  const rowClass = m.anyExpired
                    ? 'bg-red-50'
                    : m.anyExpiringSoon
                      ? 'bg-yellow-50'
                      : '';
                  return (
                    <tr key={e.id} className={rowClass}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">
                          {fullName(e)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {roleLabel(e.role)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {e.phone ?? <span className="text-gray-400">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-700">
                        {classificationLabel(e.classification)}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-700">
                        {m.certs.length === 0 ? (
                          <span className="text-gray-400">{t('crew.none')}</span>
                        ) : (
                          <ul className="space-y-0.5">
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
                                {certKindLabel(c.cert.kind)}
                                {c.cert.expiresOn && (
                                  <> &middot; {c.cert.expiresOn}</>
                                )}
                                {c.status === 'expired' && ' ' + t('crew.expired')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-700">
                        {m.tools.length === 0 ? (
                          <span className="text-gray-400">{t('crew.none')}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {m.tools.map((tool) => (
                              <li key={tool.id}>{toolIdentifier(tool)}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/crew/${e.id}`}
                          className="text-yge-blue-500 hover:underline"
                        >
                          {t('crew.edit')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
    </AppShell>
  );
}
