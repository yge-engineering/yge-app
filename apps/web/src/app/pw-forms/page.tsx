'use client';

import { useMemo, useState } from 'react';
import { AppShell, PageHeader, StatusPill, Tile } from '../../components';
import {
  buildDas140,
  buildDas142,
  buildPwc100,
  Das140InputSchema,
  Das142InputSchema,
  Pwc100InputSchema,
} from '@yge/shared';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PwFormsPage() {
  // Common fields.
  const [awardingBodyName, setAwardingBodyName] = useState('');
  const [awardingBodyAddress, setAwardingBodyAddress] = useState('');
  const [contractorName, setContractorName] = useState('Young General Engineering, Inc.');
  const [contractorAddress, setContractorAddress] = useState('19645 Little Woods Rd, Cottonwood CA 96022');
  const [contractorPhone, setContractorPhone] = useState('707-599-9921');
  const [contractorCslb, setContractorCslb] = useState('1145219');
  const [contractorDir, setContractorDir] = useState('2000018967');
  const [projectName, setProjectName] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [projectCounty, setProjectCounty] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [awardDate, setAwardDate] = useState('');
  const [estimatedStartDate, setEstimatedStartDate] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');

  // DAS-140 / DAS-142 specific.
  const [craft, setCraft] = useState('Operating Engineer');
  const [estimatedJourneyHours, setEstimatedJourneyHours] = useState('');
  const [estimatedApprenticeHours, setEstimatedApprenticeHours] = useState('');
  const [jatcName, setJatcName] = useState('');
  const [jatcAddress, setJatcAddress] = useState('');

  // DAS-142 specific.
  const [numberOfApprentices, setNumberOfApprentices] = useState('1');
  const [neededByDate, setNeededByDate] = useState('');
  const [estimatedDurationDays, setEstimatedDurationDays] = useState('');
  const [reportToAddress, setReportToAddress] = useState('');
  const [reportToContact, setReportToContact] = useState('');

  const [today, setToday] = useState(todayIso());

  const das140 = useMemo(() => {
    if (!awardingBodyName || !projectName || !projectLocation || !craft || !contractAmount || !awardDate || !jatcName || !jatcAddress) return null;
    const parsed = Das140InputSchema.safeParse({
      awardingBodyName,
      awardingBodyAddress: awardingBodyAddress || undefined,
      contractorName,
      contractorAddress,
      contractorPhone: contractorPhone || undefined,
      contractorCslb,
      contractorDir,
      projectName,
      projectLocation,
      contractAmountCents: Math.round(Number(contractAmount) * 100),
      awardDate,
      estimatedStartDate: estimatedStartDate || undefined,
      estimatedCompletionDate: estimatedCompletionDate || undefined,
      craft,
      estimatedJourneyHours: estimatedJourneyHours ? parseInt(estimatedJourneyHours, 10) : undefined,
      estimatedApprenticeHours: estimatedApprenticeHours ? parseInt(estimatedApprenticeHours, 10) : undefined,
      jatcName,
      jatcAddress,
    });
    return parsed.success ? buildDas140(parsed.data, today) : null;
  }, [awardingBodyName, awardingBodyAddress, contractorName, contractorAddress, contractorPhone, contractorCslb, contractorDir, projectName, projectLocation, contractAmount, awardDate, estimatedStartDate, estimatedCompletionDate, craft, estimatedJourneyHours, estimatedApprenticeHours, jatcName, jatcAddress, today]);

  const das142 = useMemo(() => {
    if (!projectName || !projectLocation || !craft || !numberOfApprentices || !neededByDate || !reportToAddress || !reportToContact || !jatcName || !jatcAddress) return null;
    const parsed = Das142InputSchema.safeParse({
      contractorName,
      contractorAddress,
      contractorPhone: contractorPhone || undefined,
      contractorCslb,
      contractorDir,
      projectName,
      projectLocation,
      craft,
      numberOfApprentices: parseInt(numberOfApprentices, 10),
      neededByDate,
      estimatedDurationDays: estimatedDurationDays ? parseInt(estimatedDurationDays, 10) : undefined,
      reportToAddress,
      reportToContact,
      jatcName,
      jatcAddress,
    });
    return parsed.success ? buildDas142(parsed.data, today) : null;
  }, [contractorName, contractorAddress, contractorPhone, contractorCslb, contractorDir, projectName, projectLocation, craft, numberOfApprentices, neededByDate, estimatedDurationDays, reportToAddress, reportToContact, jatcName, jatcAddress, today]);

  const pwc100 = useMemo(() => {
    if (!awardingBodyName || !projectName || !projectLocation || !projectDescription || !contractAmount || !awardDate) return null;
    const parsed = Pwc100InputSchema.safeParse({
      awardingBodyName,
      awardingBodyAddress: awardingBodyAddress || undefined,
      primeContractorName: contractorName,
      primeContractorAddress: contractorAddress,
      primeContractorCslb: contractorCslb,
      primeContractorDir: contractorDir,
      projectName,
      projectLocation,
      projectCounty: projectCounty || undefined,
      projectDescription,
      contractAmountCents: Math.round(Number(contractAmount) * 100),
      awardDate,
      estimatedStartDate: estimatedStartDate || undefined,
      estimatedCompletionDate: estimatedCompletionDate || undefined,
    });
    return parsed.success ? buildPwc100(parsed.data, today) : null;
  }, [awardingBodyName, awardingBodyAddress, contractorName, contractorAddress, contractorCslb, contractorDir, projectName, projectLocation, projectCounty, projectDescription, contractAmount, awardDate, estimatedStartDate, estimatedCompletionDate, today]);

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  function download(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="PW compliance forms"
          subtitle="Fill in project + contractor info once. The three required DIR notifications (DAS-140 award, DAS-142 dispatch request, PWC-100 project registration) render below — copy or download as needed."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Contractor (YGE)</h2>
            <div className="space-y-2 text-sm">
              <F label="Name"><Inp v={contractorName} on={setContractorName} /></F>
              <F label="Address"><Inp v={contractorAddress} on={setContractorAddress} /></F>
              <F label="Phone"><Inp v={contractorPhone} on={setContractorPhone} /></F>
              <F label="CSLB"><Inp v={contractorCslb} on={setContractorCslb} /></F>
              <F label="DIR PWC #"><Inp v={contractorDir} on={setContractorDir} /></F>
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Awarding body</h2>
            <div className="space-y-2 text-sm">
              <F label="Name"><Inp v={awardingBodyName} on={setAwardingBodyName} placeholder="e.g. CAL FIRE" /></F>
              <F label="Address (optional)"><Inp v={awardingBodyAddress} on={setAwardingBodyAddress} /></F>
              <F label="Today (for status)">
                <input type="date" value={today} onChange={(e) => setToday(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </F>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Project</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <F label="Project name"><Inp v={projectName} on={setProjectName} /></F>
            <F label="Location"><Inp v={projectLocation} on={setProjectLocation} /></F>
            <F label="County"><Inp v={projectCounty} on={setProjectCounty} /></F>
            <F label="Contract amount ($)"><input type="number" step="0.01" min="0" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
            <F label="Award date"><input type="date" value={awardDate} onChange={(e) => setAwardDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
            <F label="Estimated start"><input type="date" value={estimatedStartDate} onChange={(e) => setEstimatedStartDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
            <F label="Estimated completion"><input type="date" value={estimatedCompletionDate} onChange={(e) => setEstimatedCompletionDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
            <F label="Description"><textarea rows={2} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Craft + JATC (DAS-140/142)</h2>
            <div className="space-y-2 text-sm">
              <F label="Craft"><Inp v={craft} on={setCraft} /></F>
              <div className="grid grid-cols-2 gap-2">
                <F label="Est. journey hr"><input type="number" min="0" value={estimatedJourneyHours} onChange={(e) => setEstimatedJourneyHours(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
                <F label="Est. apprentice hr"><input type="number" min="0" value={estimatedApprenticeHours} onChange={(e) => setEstimatedApprenticeHours(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
              </div>
              <F label="JATC name"><Inp v={jatcName} on={setJatcName} placeholder="e.g. OE Local 3 JATC — Region 4" /></F>
              <F label="JATC address"><Inp v={jatcAddress} on={setJatcAddress} /></F>
            </div>
          </div>
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Dispatch request (DAS-142)</h2>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <F label="Apprentices needed"><input type="number" min="1" value={numberOfApprentices} onChange={(e) => setNumberOfApprentices(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
                <F label="Needed by date"><input type="date" value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
              </div>
              <F label="Est. duration (days)"><input type="number" min="1" value={estimatedDurationDays} onChange={(e) => setEstimatedDurationDays(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" /></F>
              <F label="Report-to address"><Inp v={reportToAddress} on={setReportToAddress} /></F>
              <F label="Report-to contact"><Inp v={reportToContact} on={setReportToContact} /></F>
            </div>
          </div>
        </div>

        {/* Form outputs */}
        {das140 ? (
          <FormSection
            title="DAS-140 — Contract Award Information"
            statusLabel={das140.daysUntilDeadline < 0 ? `${Math.abs(das140.daysUntilDeadline)}d PAST` : `${das140.daysUntilDeadline}d to notify`}
            tone={das140.daysUntilDeadline < 0 ? 'danger' : das140.daysUntilDeadline <= 3 ? 'warn' : 'success'}
            deadlineLabel={`Notify-by: ${das140.notifyByDate} (10 days from award)`}
            text={das140.formText}
            filenamePrefix="das-140"
            onCopy={() => copy(das140.formText)}
            onDownload={() => download(das140.formText, `das-140-${(projectName || 'project').replace(/[^\w.-]+/g, '_')}.txt`)}
          />
        ) : null}

        {das142 ? (
          <FormSection
            title="DAS-142 — Request for Dispatch of Apprentices"
            statusLabel={das142.noticeDaysGiven < 0 ? `${Math.abs(das142.noticeDaysGiven)}d past` : `${das142.noticeDaysGiven}d notice`}
            tone={das142.noticeDaysGiven < 0 ? 'danger' : das142.noticeDaysGiven < 3 ? 'warn' : 'success'}
            deadlineLabel={`Earliest compliant: ${das142.earliestComplianceDate} (72 business hours)`}
            text={das142.formText}
            filenamePrefix="das-142"
            onCopy={() => copy(das142.formText)}
            onDownload={() => download(das142.formText, `das-142-${(projectName || 'project').replace(/[^\w.-]+/g, '_')}.txt`)}
          />
        ) : null}

        {pwc100 ? (
          <FormSection
            title="PWC-100 — Public Works Project Registration"
            statusLabel={pwc100.daysUntilDeadline < 0 ? `${Math.abs(pwc100.daysUntilDeadline)}d PAST` : `${pwc100.daysUntilDeadline}d to register`}
            tone={pwc100.daysUntilDeadline < 0 ? 'danger' : pwc100.daysUntilDeadline <= 2 ? 'warn' : 'success'}
            deadlineLabel={`Register by: ${pwc100.registerByDate} (5 days post-award)`}
            text={pwc100.formText}
            filenamePrefix="pwc-100"
            onCopy={() => copy(pwc100.formText)}
            onDownload={() => download(pwc100.formText, `pwc-100-${(projectName || 'project').replace(/[^\w.-]+/g, '_')}.txt`)}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Inp({ v, on, placeholder }: { v: string; on: (s: string) => void; placeholder?: string }) {
  return (
    <input
      value={v}
      onChange={(e) => on(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
    />
  );
}

function FormSection({
  title,
  statusLabel,
  tone,
  deadlineLabel,
  text,
  filenamePrefix,
  onCopy,
  onDownload,
}: {
  title: string;
  statusLabel: string;
  tone: 'danger' | 'warn' | 'success';
  deadlineLabel: string;
  text: string;
  filenamePrefix: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <section className="mt-4 rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <StatusPill label={statusLabel} tone={tone} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{deadlineLabel}</span>
          <button type="button" onClick={onCopy} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50">
            📋 Copy
          </button>
          <button type="button" onClick={onDownload} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
            ⬇ .txt
          </button>
        </div>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs text-gray-900">{text}</pre>
    </section>
  );
}
