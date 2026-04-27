// /incidents/[id]/301 — printable OSHA Form 301 Injury and Illness Incident Report.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  incidentClassificationLabel,
  type Incident,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchIncident(id: string): Promise<Incident | null> {
  const res = await fetch(`${apiBaseUrl()}/api/incidents/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { incident: Incident }).incident;
}

export default async function Form301Page({
  params,
}: {
  params: { id: string };
}) {
  const inc = await fetchIncident(params.id);
  if (!inc) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8 text-black">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/incidents/${inc.id}`} className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back
        </Link>
        <span className="text-xs text-gray-500">Use your browser's Print menu (Ctrl/Cmd+P)</span>
      </div>

      <article className="bg-white p-8 text-sm leading-relaxed shadow-sm print:shadow-none">
        <header className="mb-4 text-center">
          <h1 className="text-lg font-bold uppercase">
            OSHA's Form 301
          </h1>
          <p className="text-xs">Injury and Illness Incident Report</p>
          <p className="mt-1 text-xs">Young General Engineering, Inc.</p>
        </header>

        <p className="mb-4 rounded border border-gray-400 p-2 text-[10px]">
          This Injury and Illness Incident Report is one of the first forms you
          must fill out when a recordable work-related injury or illness has
          occurred. Together with the Log of Work-Related Injuries and Illnesses
          and the accompanying Summary, these forms help the employer and OSHA
          develop a picture of the extent and severity of work-related incidents.
        </p>

        <Block title="Information about the employee">
          <Grid>
            <Field label="1) Full name">{inc.employeeName}</Field>
            <Field label="2) Date of birth">&nbsp;</Field>
            <Field label="3) Date hired">{inc.hireDate ?? '\u00A0'}</Field>
            <Field label="4) Job title">{inc.jobTitle ?? '\u00A0'}</Field>
          </Grid>
        </Block>

        <Block title="Information about the physician or other health care professional">
          <Grid>
            <Field label="6) Name of physician or other health care professional">
              {inc.physicianName ?? '\u00A0'}
            </Field>
            <Field label="7) Treated in ER?">{inc.treatedInER ? 'Yes' : 'No'}</Field>
            <Field label="8) Hospitalized overnight as inpatient?">
              {inc.hospitalizedOvernight ? 'Yes' : 'No'}
            </Field>
          </Grid>
          <Grid>
            <Field label="Facility name">{inc.facilityName ?? '\u00A0'}</Field>
            <Field label="Facility address">{inc.facilityAddress ?? '\u00A0'}</Field>
          </Grid>
        </Block>

        <Block title="Information about the case">
          <Grid>
            <Field label="9) Case number">{inc.caseNumber}</Field>
            <Field label="10) Date of injury or illness">{inc.incidentDate}</Field>
            <Field label="11) Time employee began work">{inc.workStartTime ?? '\u00A0'}</Field>
            <Field label="12) Time of event">{inc.incidentTime ?? '\u00A0'}</Field>
          </Grid>
          <FullField label="13) What was the employee doing just before the incident occurred?">
            {inc.taskBeforeIncident ?? '\u00A0'}
          </FullField>
          <FullField label="14) What happened? Tell us how the injury occurred.">
            {inc.whatHappened ?? '\u00A0'}
          </FullField>
          <FullField label="15) What was the injury or illness? Tell us the part of the body that was affected and how it was affected.">
            {inc.injuryDescription ?? inc.description}
          </FullField>
          <FullField label="16) What object or substance directly harmed the employee?">
            {inc.harmingAgent ?? '\u00A0'}
          </FullField>
          <FullField label="17) If the employee died, when did death occur?">
            {inc.died ? inc.dateOfDeath ?? '\u00A0' : 'N/A'}
          </FullField>
          <FullField label="Classification">
            {incidentClassificationLabel(inc.classification)}
          </FullField>
        </Block>

        <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="font-semibold uppercase">Completed by</div>
            <div className="mt-1 border-b border-gray-400 pb-1">
              {inc.preparedByName ?? '\u00A0'}
            </div>
          </div>
          <div>
            <div className="font-semibold uppercase">Title</div>
            <div className="mt-1 border-b border-gray-400 pb-1">
              {inc.preparedByTitle ?? '\u00A0'}
            </div>
          </div>
          <div>
            <div className="font-semibold uppercase">Date</div>
            <div className="mt-1 border-b border-gray-400 pb-1">
              {inc.preparedOn ?? '\u00A0'}
            </div>
          </div>
        </div>

        <p className="mt-6 text-[10px] italic text-gray-600">
          Required under federal regulation 29 CFR 1904.7 and California Code of
          Regulations Title 8 §14300. Complete within 7 calendar days of
          learning of the injury / illness.
        </p>
      </article>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h2 className="rounded bg-gray-200 px-2 py-1 text-xs font-bold uppercase">
        {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 text-xs">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-gray-700">{label}</div>
      <div className="mt-0.5 border-b border-gray-400 pb-0.5 text-sm">{children}</div>
    </div>
  );
}

function FullField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-gray-700">{label}</div>
      <div className="mt-0.5 min-h-[36px] whitespace-pre-wrap rounded border border-gray-300 p-2 text-sm">
        {children}
      </div>
    </div>
  );
}
