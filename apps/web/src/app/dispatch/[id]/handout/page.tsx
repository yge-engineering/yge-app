// /dispatch/[id]/handout — single-page yard handout for the foreman.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  coerceLocale,
  dispatchStatusLabel,
  type Dispatch,
} from '@yge/shared';
import { getTranslator } from '../../../../lib/locale';
import { cookies } from 'next/headers';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDispatch(id: string): Promise<Dispatch | null> {
  const res = await fetch(`${apiBaseUrl()}/api/dispatches/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { dispatch: Dispatch }).dispatch;
}

export default async function DispatchHandoutPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);
  const d = await fetchDispatch(params.id);
  if (!d) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/dispatch/${d.id}`} className="text-sm text-yge-blue-500 hover:underline">
          {t('handoutPg.back')}
        </Link>
        <span className="text-xs text-gray-500">{t('prequalPg.printHint')}</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <header className="mb-4 flex items-end justify-between border-b-2 border-black pb-2">
          <div>
            <div className="text-xs uppercase tracking-wide">{t('handoutPg.docTitle')}</div>
            <h1 className="text-2xl font-bold">{d.scheduledFor}</h1>
            <p className="text-sm">{t('handoutPg.jobLabel', { id: d.jobId })}</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide">Young General Engineering, Inc.</div>
            <div className="text-xs">19645 Little Woods Rd, Cottonwood CA 96022</div>
            <div className="text-xs">{t('handoutPg.statusLabel', { status: dispatchStatusLabel(d.status, locale) })}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 text-sm">
          <Field label={t('handoutPg.lblForeman')}>{d.foremanName}</Field>
          <Field label={t('handoutPg.lblForemanPhone')}>{d.foremanPhone ?? '—'}</Field>
          <Field label={t('handoutPg.lblMeetTime')}>{d.meetTime ?? '—'}</Field>
          <Field label={t('handoutPg.lblMeetLocation')}>{d.meetLocation ?? '—'}</Field>
        </section>

        <section className="mt-4">
          <Heading>{t('handoutPg.scopeHeader')}</Heading>
          <div className="whitespace-pre-wrap rounded border border-gray-300 p-2 text-sm">
            {d.scopeOfWork}
          </div>
        </section>

        {d.specialInstructions && (
          <section className="mt-4">
            <Heading>{t('handoutPg.specialHeader')}</Heading>
            <div className="whitespace-pre-wrap rounded border border-gray-300 bg-yellow-50 p-2 text-sm">
              {d.specialInstructions}
            </div>
          </section>
        )}

        <section className="mt-4">
          <Heading>{t('handoutPg.crewHeader', { count: d.crew.length })}</Heading>
          {d.crew.length === 0 ? (
            <p className="text-xs text-gray-500">{t('handoutPg.noCrew')}</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="w-8 px-1 py-1 text-left">#</th>
                  <th className="px-1 py-1 text-left">{t('handoutPg.thName')}</th>
                  <th className="w-32 px-1 py-1 text-left">{t('handoutPg.thRole')}</th>
                  <th className="px-1 py-1 text-left">{t('handoutPg.thNote')}</th>
                </tr>
              </thead>
              <tbody>
                {d.crew.map((c, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="px-1 py-1">{i + 1}</td>
                    <td className="px-1 py-1">{c.name}</td>
                    <td className="px-1 py-1">{c.role ?? ''}</td>
                    <td className="px-1 py-1">{c.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-4">
          <Heading>{t('handoutPg.equipHeader', { count: d.equipment.length })}</Heading>
          {d.equipment.length === 0 ? (
            <p className="text-xs text-gray-500">{t('handoutPg.noEquip')}</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="w-8 px-1 py-1 text-left">#</th>
                  <th className="px-1 py-1 text-left">{t('handoutPg.thEquipment')}</th>
                  <th className="w-40 px-1 py-1 text-left">{t('handoutPg.thOperator')}</th>
                  <th className="px-1 py-1 text-left">{t('handoutPg.thNote')}</th>
                </tr>
              </thead>
              <tbody>
                {d.equipment.map((e, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="px-1 py-1">{i + 1}</td>
                    <td className="px-1 py-1">{e.name}</td>
                    <td className="px-1 py-1">{e.operatorName ?? ''}</td>
                    <td className="px-1 py-1">{e.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase">{t('handoutPg.foremanAck')}</div>
            <div className="mt-6 border-b border-gray-400" />
            <div className="mt-1 text-xs text-gray-600">{d.foremanName}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase">{t('prequalPg.dateLabel')}</div>
            <div className="mt-6 border-b border-gray-400 text-sm">{d.scheduledFor}</div>
          </div>
        </section>
      </article>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-gray-700">{label}</div>
      <div className="mt-0.5 border-b border-gray-400 pb-0.5 text-sm">{children}</div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
      {children}
    </h2>
  );
}
