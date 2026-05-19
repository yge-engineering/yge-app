// /estimates/[id]/notice-to-proceed — print-ready Notice to Proceed for one
// listed sub. Query-param driven; the sidebar form mutates the URL via
// plain GET submission so no client JS is required.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildSubNoticeToProceed,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubBid,
  type SubNoticeToProceedFieldContact,
} from '@yge/shared';
import { AppShell } from '../../../../components';
import { PrintButton } from '@/components/print-button';
import { Letterhead } from '@/components/letterhead';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return (await res.json()) as FullResponse;
}

function splitReminders(raw: string | undefined): string[] {
  if (!raw) return [];
  // Bullets are line-separated in the textarea; tolerate ; or | as well.
  return raw
    .split(/\r?\n|;|\|/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default async function NoticeToProceedPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    subId?: string;
    mobDate?: string;
    startTime?: string;
    reportTo?: string;
    fcName?: string;
    fcPhone?: string;
    fcTitle?: string;
    reminders?: string;
  };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;

  const subs: SubBid[] = estimate.subBids;
  if (subs.length === 0) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl p-8">
          <Link href={`/estimates/${estimate.id}`} className="text-yge-blue-500 hover:underline">
            &larr; Back to estimate
          </Link>
          <h1 className="mt-4 text-xl font-bold">Notice to Proceed</h1>
          <p className="mt-2 text-sm text-gray-700">
            This estimate has no listed subcontractors. Add subs to the bid
            first, then come back to issue mobilization letters.
          </p>
        </main>
      </AppShell>
    );
  }

  const selectedSubId = searchParams.subId ?? subs[0]?.id;
  const sub = subs.find((s) => s.id === selectedSubId) ?? subs[0];
  if (!sub) notFound();

  const mobDate = searchParams.mobDate?.trim() ?? '';
  const reminders = splitReminders(searchParams.reminders);

  let fieldContact: SubNoticeToProceedFieldContact | undefined;
  const fcName = searchParams.fcName?.trim();
  if (fcName && fcName.length > 0) {
    fieldContact = {
      name: fcName,
      phone: searchParams.fcPhone?.trim() ?? '',
      title: searchParams.fcTitle?.trim() || undefined,
    };
  }

  const ntp = mobDate.length > 0
    ? buildSubNoticeToProceed(estimate, sub, {
        mobilizationStartDate: mobDate,
        dailyStartTime: searchParams.startTime?.trim() || undefined,
        reportToAddress: searchParams.reportTo?.trim() || undefined,
        fieldContact,
        scopeReminderBullets: reminders,
      })
    : null;

  return (
    <AppShell>
      <style>{`
        @page { margin: 0.75in 0.75in; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto max-w-5xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            &larr; Back to estimate
          </Link>
          <PrintButton />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <aside className="no-print rounded border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Notice parameters
            </h2>
            <form method="GET" className="mt-2 space-y-3">
              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Listed sub
                </span>
                <select
                  name="subId"
                  defaultValue={sub.id}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.contractorName} — {s.portionOfWork.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Mobilization start date *
                </span>
                <input
                  type="text"
                  name="mobDate"
                  defaultValue={mobDate}
                  placeholder="e.g. June 2, 2026"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  required
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Daily start time
                </span>
                <input
                  type="text"
                  name="startTime"
                  defaultValue={searchParams.startTime ?? ''}
                  placeholder="7:00 AM"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Report-to address (staging area)
                </span>
                <input
                  type="text"
                  name="reportTo"
                  defaultValue={searchParams.reportTo ?? ''}
                  placeholder="Soquol Rd & Hwy 5 staging yard"
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                />
              </label>

              <fieldset className="rounded border border-gray-200 p-2">
                <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Field contact (who they meet on day 1)
                </legend>
                <label className="block">
                  <span className="block text-[10px] text-gray-500">Name</span>
                  <input
                    type="text"
                    name="fcName"
                    defaultValue={searchParams.fcName ?? ''}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="block text-[10px] text-gray-500">Phone</span>
                  <input
                    type="text"
                    name="fcPhone"
                    defaultValue={searchParams.fcPhone ?? ''}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="block text-[10px] text-gray-500">Title</span>
                  <input
                    type="text"
                    name="fcTitle"
                    defaultValue={searchParams.fcTitle ?? ''}
                    placeholder="YGE Field Superintendent"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                  />
                </label>
              </fieldset>

              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Scope reminders (one per line)
                </span>
                <textarea
                  name="reminders"
                  rows={4}
                  defaultValue={searchParams.reminders ?? ''}
                  placeholder={'High-vis required\nDaily timecards via portal'}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded bg-yge-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-yge-blue-700"
              >
                Update letter
              </button>
            </form>
          </aside>

          {ntp ? (
            <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
              <Letterhead />

              <div className="mt-6 text-right text-xs text-gray-600">{ntp.date}</div>

              <div className="mt-2 text-xs">
                <div className="font-semibold">{ntp.addressee.contractorName}</div>
                {ntp.addressee.addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
                {(ntp.addressee.cslbLicense || ntp.addressee.dirRegistration) && (
                  <div className="mt-1 text-[11px] text-gray-600">
                    {ntp.addressee.cslbLicense && (
                      <span>CSLB #{ntp.addressee.cslbLicense}</span>
                    )}
                    {ntp.addressee.cslbLicense && ntp.addressee.dirRegistration && (
                      <span> · </span>
                    )}
                    {ntp.addressee.dirRegistration && (
                      <span>DIR #{ntp.addressee.dirRegistration}</span>
                    )}
                  </div>
                )}
              </div>

              <h1 className="mt-4 border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
                {ntp.subjectLine}
              </h1>

              <p className="mt-3">{ntp.salutation}</p>

              {ntp.bodyParagraphs.map((para, i) => (
                <p className="mt-3" key={i}>
                  {para}
                </p>
              ))}

              <div className="mt-4 rounded border border-black bg-gray-50 p-3 text-xs print:bg-white">
                <div className="font-semibold uppercase tracking-wide">Scope under this NTP</div>
                <div className="mt-1">
                  <span className="font-semibold">Portion of work:</span>{' '}
                  {ntp.scopeBlock.portionOfWork}
                </div>
                <div>
                  <span className="font-semibold">Subcontract amount:</span>{' '}
                  {ntp.scopeBlock.bidAmountUsd}
                </div>
              </div>

              <div className="mt-4 rounded border border-green-500 bg-green-50 p-3 text-xs print:bg-white">
                <div className="font-semibold uppercase tracking-wide">Mobilization</div>
                <div className="mt-1">
                  <span className="font-semibold">Start date:</span>{' '}
                  {ntp.mobilizationBlock.startDate}
                </div>
                <div>
                  <span className="font-semibold">Daily start time:</span>{' '}
                  {ntp.mobilizationBlock.dailyStartTime}
                </div>
                {ntp.mobilizationBlock.reportToAddress && (
                  <div>
                    <span className="font-semibold">Report to:</span>{' '}
                    {ntp.mobilizationBlock.reportToAddress}
                  </div>
                )}
                {ntp.mobilizationBlock.fieldContact && (
                  <div className="mt-1">
                    <span className="font-semibold">Field contact:</span>{' '}
                    {ntp.mobilizationBlock.fieldContact.name}
                    {ntp.mobilizationBlock.fieldContact.title &&
                      ` (${ntp.mobilizationBlock.fieldContact.title})`}
                    {' · '}
                    {ntp.mobilizationBlock.fieldContact.phone}
                  </div>
                )}
              </div>

              {ntp.scopeReminderBullets.length > 0 && (
                <>
                  <p className="mt-4 font-semibold">Reminders for the field:</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {ntp.scopeReminderBullets.map((b) => (
                      <li key={b} className="mt-1">
                        {b}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="mt-4">{ntp.closingParagraph}</p>

              <div className="mt-6">
                <p>{ntp.closing.line}</p>
                <div className="mt-10 border-t border-gray-400 pt-1">
                  <div className="text-sm font-semibold">{ntp.closing.signer.name}</div>
                  <div className="text-xs">{ntp.closing.signer.title}</div>
                  <div className="text-xs">{ntp.closing.signer.company}</div>
                  <div className="text-xs text-gray-600">
                    {ntp.closing.signer.phone} · {ntp.closing.signer.email}
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Choose a mobilization start date</strong> in the sidebar
              to render the Notice to Proceed. Until a date is set the letter
              stays blank — the field crew needs the day clearly stated so we
              don't render a draft that looks final.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
