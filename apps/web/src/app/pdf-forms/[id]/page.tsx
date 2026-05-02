// /pdf-forms/[id] — per-form preview + fill surface.
//
// Loads the mapping, runs a dry-run preview against the master
// profile (no operator answers yet on first paint), and shows:
//   - Top banner: 'auto-fills X of Y; you'll be asked for Z; W
//     required-but-blank'
//   - Per-field table with the computed value + source recipe
//   - Inline form rows for every prompt-source field, so the
//     operator answers project number / etc. and re-runs the
//     preview through the client island
//   - Audit binder panel for this mapping (entityType=Document)
//
// The Download button POSTs to /api/pdf-form-mappings/:id/fill,
// which runs pdf-lib against the source PDF + computed values and
// streams back the filled + flattened bytes. The byte sha256 lands
// in the X-PDF-Sha256 response header so the signing flow can
// finalize against it.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  AppShell,
  AuditBinderPanel,
  PageHeader,
  StatusPill,
} from '../../../components';
import { PdfFormPromptForm } from '@/components/pdf-form-prompt-form';
import {
  buildFillReport,
  type MasterProfile,
  type PdfFormMapping,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchMapping(id: string): Promise<PdfFormMapping | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/pdf-form-mappings/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { mapping: PdfFormMapping }).mapping;
  } catch { return null; }
}

async function fetchProfile(): Promise<MasterProfile | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/master-profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { profile: MasterProfile }).profile;
  } catch { return null; }
}

export default async function PdfFormFillPage({
  params,
}: {
  params: { id: string };
}) {
  const [mapping, profile] = await Promise.all([fetchMapping(params.id), fetchProfile()]);
  if (!mapping) notFound();
  if (!profile) {
    return (
      <AppShell>
        <main className="mx-auto max-w-4xl p-8">
          <Alert tone="danger" title="Master profile unavailable">
            Could not load /api/master-profile. The form filler can&rsquo;t
            preview without it.
          </Alert>
        </main>
      </AppShell>
    );
  }

  // First-paint report uses no operator answers — the prompt fields
  // surface as awaitingPrompt rows.
  const report = buildFillReport(mapping, { profile });

  const promptFields = mapping.fields.filter((f) => f.source.kind === 'prompt');

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/pdf-forms" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Form library
          </Link>
          <Link href="/master-profile" className="text-xs text-yge-blue-500 hover:underline">
            Master profile →
          </Link>
        </div>

        <PageHeader
          title={mapping.displayName}
          subtitle={`${mapping.agency}${mapping.formCode ? ` · ${mapping.formCode}` : ''}${mapping.versionDate ? ` · v${mapping.versionDate}` : ''}`}
        />

        {!mapping.reviewed && (
          <Alert tone="warn" className="mt-4" title="This mapping is a draft">
            It hasn&rsquo;t been reviewed against the agency PDF yet. PATCH the
            row with reviewed=true once you&rsquo;ve verified every field.
          </Alert>
        )}

        <FillSummary report={report} />

        {promptFields.length > 0 && (
          <PdfFormPromptForm
            apiBaseUrl={publicApiBaseUrl()}
            mappingId={mapping.id}
            promptFields={promptFields.map((f) => ({
              fieldId: f.id,
              label: f.source.kind === 'prompt' ? f.source.label : f.label,
              hint: f.source.kind === 'prompt' ? f.source.hint : undefined,
              sensitive: f.source.kind === 'prompt' ? f.source.sensitive : false,
              required: f.required,
            }))}
          />
        )}

        <FieldTable mapping={mapping} report={report} />

        <AuditBinderPanel entityType="Document" entityId={mapping.id} className="mt-8" />

        <p className="mt-8 text-xs text-gray-500">
          Download streams a filled + flattened PDF (pdf-lib runtime). The
          source PDF must exist under{' '}
          <code className="font-mono">apps/api/data/pdf-forms/</code> at the
          path on the mapping&rsquo;s <code className="font-mono">pdfReference</code>.
          The byte sha256 lands in the response&rsquo;s{' '}
          <code className="font-mono">X-PDF-Sha256</code> header so the
          signing flow can finalize against it.
        </p>
      </main>
    </AppShell>
  );
}

function FillSummary({ report }: { report: ReturnType<typeof buildFillReport> }) {
  if (report.requiredEmpty.length > 0) {
    return (
      <Alert
        tone="danger"
        className="mt-4"
        title={`${report.requiredEmpty.length} required field${report.requiredEmpty.length === 1 ? '' : 's'} blank`}
      >
        Fill the prompts below or update the master profile so these resolve
        before downloading the filled PDF.
      </Alert>
    );
  }
  if (report.awaitingSensitivePrompts.length > 0) {
    return (
      <Alert
        tone="warn"
        className="mt-4"
        title={`${report.awaitingSensitivePrompts.length} sensitive value${report.awaitingSensitivePrompts.length === 1 ? '' : 's'} needed inline`}
      >
        Sensitive prompts (SSN-style) are intentionally NOT stored on the
        master profile. Enter them at fill time below.
      </Alert>
    );
  }
  if (report.patternViolations.length > 0) {
    return (
      <Alert
        tone="warn"
        className="mt-4"
        title={`${report.patternViolations.length} field${report.patternViolations.length === 1 ? '' : 's'} fail pattern check`}
      >
        Some computed values don&rsquo;t match the form&rsquo;s expected
        pattern (e.g. ZIP, DIR registration). Fix the source value before
        submitting.
      </Alert>
    );
  }
  if (report.awaitingPromptCount === 0) {
    return (
      <Alert
        tone="success"
        className="mt-4"
        title={`Ready — all ${report.total} fields resolve`}
      >
        Every field has a value from the master profile or a literal /
        computed source. The form is ready to download.
      </Alert>
    );
  }
  return (
    <Alert
      tone="info"
      className="mt-4"
      title={`Auto-fills ${report.filledCount} of ${report.total} fields`}
    >
      You&rsquo;ll be asked for {report.awaitingPromptCount} value
      {report.awaitingPromptCount === 1 ? '' : 's'} inline below before the
      filled PDF is ready.
    </Alert>
  );
}

function FieldTable({
  mapping,
  report,
}: {
  mapping: PdfFormMapping;
  report: ReturnType<typeof buildFillReport>;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Label</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-left">Value (preview)</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {mapping.fields.map((f, i) => {
            const v = report.values[i]!;
            return (
              <tr key={f.id}>
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-gray-900">{f.label}</div>
                  <div className="text-xs text-gray-500 font-mono">{f.pdfFieldName}</div>
                </td>
                <td className="px-3 py-2 align-top text-xs">
                  <div className="font-mono uppercase text-gray-700">{f.source.kind}</div>
                  {f.source.kind === 'profile-path' && (
                    <div className="text-gray-500 font-mono">{f.source.path}</div>
                  )}
                  {f.source.kind === 'literal' && (
                    <div className="text-gray-500 italic">"{f.source.value}"</div>
                  )}
                  {f.source.kind === 'computed' && (
                    <div className="text-gray-500 font-mono">{f.source.name}</div>
                  )}
                  {f.source.kind === 'prompt' && (
                    <div className="text-gray-500">{f.source.label}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  {v.value === '' ? (
                    <span className="text-gray-400 italic">—</span>
                  ) : f.source.kind === 'prompt' && (f.source as { sensitive?: boolean }).sensitive ? (
                    <span className="font-mono text-gray-700">{'•'.repeat(Math.min(v.value.length, 8))}</span>
                  ) : (
                    <span className="text-gray-900">{v.value}</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {v.awaitingPrompt && <StatusPill label="ASK" tone="warn" size="sm" />}
                  {!v.awaitingPrompt && v.filled && f.required && (
                    <StatusPill label="OK" tone="success" size="sm" />
                  )}
                  {!v.awaitingPrompt && !v.filled && f.required && (
                    <StatusPill label="EMPTY" tone="danger" size="sm" />
                  )}
                  {!v.awaitingPrompt && !v.filled && !f.required && (
                    <span className="text-xs text-gray-400">optional</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
