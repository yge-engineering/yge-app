// /toolbox-talks/[id]/sign-in — printable Cal/OSHA §1509 sign-in sheet.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ToolboxTalk } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTalk(id: string): Promise<ToolboxTalk | null> {
  const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { talk: ToolboxTalk }).talk;
}

export default async function ToolboxTalkSignInPage({
  params,
}: {
  params: { id: string };
}) {
  const talk = await fetchTalk(params.id);
  if (!talk) notFound();

  // Pad attendee list out to 20 rows so there's always room for additional
  // signatures collected on paper.
  const blanks = Math.max(0, 20 - talk.attendees.length);

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/toolbox-talks/${talk.id}`} className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back
        </Link>
        <span className="text-xs text-gray-500">Use your browser's Print menu (Ctrl/Cmd+P)</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <header className="mb-4 text-center">
          <h1 className="text-lg font-bold uppercase">Tailgate Safety Meeting Sign-In</h1>
          <p className="text-xs">
            Young General Engineering, Inc. · Cal/OSHA T8 §1509 record
          </p>
        </header>

        <table className="mb-4 w-full text-sm">
          <tbody>
            <Row label="Date" value={talk.heldOn} />
            <Row label="Topic" value={talk.topic} />
            <Row label="Location" value={talk.location ?? '—'} />
            <Row label="Meeting Leader" value={`${talk.leaderName}${talk.leaderTitle ? ' (' + talk.leaderTitle + ')' : ''}`} />
            {talk.jobId && <Row label="Job" value={talk.jobId} />}
          </tbody>
        </table>

        {talk.body && (
          <section className="mb-4">
            <div className="text-xs font-semibold uppercase">Talking Points</div>
            <div className="mt-1 whitespace-pre-wrap rounded border border-gray-300 p-2 text-xs">
              {talk.body}
            </div>
          </section>
        )}

        <section>
          <div className="text-xs font-semibold uppercase">Attendees</div>
          <table className="mt-2 w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="w-10 px-1 py-1 text-left">#</th>
                <th className="px-1 py-1 text-left">Print Name</th>
                <th className="w-32 px-1 py-1 text-left">Classification</th>
                <th className="w-40 px-1 py-1 text-left">Signature</th>
              </tr>
            </thead>
            <tbody>
              {talk.attendees.map((a, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-1 py-2">{i + 1}</td>
                  <td className="px-1 py-2">{a.name}</td>
                  <td className="px-1 py-2">{a.classification ?? ''}</td>
                  <td className="px-1 py-2">{a.signed ? a.initials ?? '\u00A0' : '\u00A0'}</td>
                </tr>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <tr key={`blank-${i}`} className="border-b border-gray-200">
                  <td className="px-1 py-2">{talk.attendees.length + i + 1}</td>
                  <td className="px-1 py-2">&nbsp;</td>
                  <td className="px-1 py-2">&nbsp;</td>
                  <td className="px-1 py-2">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase">Leader Signature</div>
            <div className="mt-6 border-b border-gray-400" />
            <div className="mt-1 text-xs text-gray-600">
              {talk.leaderName} · {talk.leaderTitle ?? ''}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase">Date Submitted</div>
            <div className="mt-6 border-b border-gray-400 text-sm">
              {talk.submittedOn ?? '\u00A0'}
            </div>
          </div>
        </section>

        <p className="mt-6 text-[10px] italic text-gray-600">
          Maintained per California Code of Regulations, Title 8 §1509(e). Subject
          to inspection by the Division of Occupational Safety and Health.
        </p>
      </article>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-1/3 py-1 align-top text-xs font-semibold uppercase">{label}:</td>
      <td className="py-1 align-top text-sm">{value}</td>
    </tr>
  );
}
