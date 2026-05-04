'use client';

// Certificate editor — kind-aware. Insurance kinds expose limit fields,
// bonding profiles expose cap + rate fields. Other kinds get the basic
// label + number + dates.

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  certificateExpiryLevel,
  certificateKindLabel,
  certificateStatusLabel,
  daysUntilExpiry,
  type Certificate,
  type CertificateKind,
  type CertificateStatus,
} from '@yge/shared';

const KINDS: CertificateKind[] = [
  'CSLB_LICENSE',
  'DIR_REGISTRATION',
  'BUSINESS_LICENSE',
  'CONTRACTOR_LICENSE',
  'GENERAL_LIABILITY',
  'AUTO_INSURANCE',
  'WORKERS_COMP',
  'UMBRELLA',
  'POLLUTION',
  'PROFESSIONAL',
  'BOND_PROFILE',
  'DOT_REGISTRATION',
  'TAX_CLEARANCE',
  'DBE_CERT',
  'OTHER',
];

const STATUSES: CertificateStatus[] = ['ACTIVE', 'SUPERSEDED', 'REVOKED'];

const INSURANCE_KINDS: CertificateKind[] = [
  'GENERAL_LIABILITY',
  'AUTO_INSURANCE',
  'WORKERS_COMP',
  'UMBRELLA',
  'POLLUTION',
  'PROFESSIONAL',
];

interface Props {
  initial: Certificate;
  apiBaseUrl: string;
}

export function CertificateEditor({ initial, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [c, setC] = useState<Certificate>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(c.label);
  const [issuer, setIssuer] = useState(c.issuingAuthority ?? '');
  const [number, setNumber] = useState(c.certificateNumber ?? '');
  const [effectiveOn, setEffectiveOn] = useState(c.effectiveOn ?? '');
  const [expiresOn, setExpiresOn] = useState(c.expiresOn ?? '');
  const [perOcc, setPerOcc] = useState(
    c.perOccurrenceLimitCents !== undefined
      ? (c.perOccurrenceLimitCents / 100).toFixed(2)
      : '',
  );
  const [agg, setAgg] = useState(
    c.aggregateLimitCents !== undefined
      ? (c.aggregateLimitCents / 100).toFixed(2)
      : '',
  );
  const [deductible, setDeductible] = useState(
    c.deductibleCents !== undefined ? (c.deductibleCents / 100).toFixed(2) : '',
  );
  const [singleJobCap, setSingleJobCap] = useState(
    c.singleJobCapCents !== undefined ? (c.singleJobCapCents / 100).toFixed(2) : '',
  );
  const [bondAggCap, setBondAggCap] = useState(
    c.bondingAggregateCapCents !== undefined
      ? (c.bondingAggregateCapCents / 100).toFixed(2)
      : '',
  );
  const [bondRate, setBondRate] = useState(
    c.bondRateBps !== undefined ? (c.bondRateBps / 10_000).toFixed(4) : '',
  );
  const [agentName, setAgentName] = useState(c.agentName ?? '');
  const [agentPhone, setAgentPhone] = useState(c.agentPhone ?? '');
  const [agentEmail, setAgentEmail] = useState(c.agentEmail ?? '');
  const [pdfUrl, setPdfUrl] = useState(c.pdfUrl ?? '');
  const [notes, setNotes] = useState(c.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/certificates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('cert.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { certificate: Certificate };
      setC(json.certificate);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cert.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function dollarsToCents(s: string): number | undefined {
    if (s.trim().length === 0) return undefined;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100);
  }

  function saveAll() {
    void patch({
      label: label.trim() || c.label,
      issuingAuthority: issuer.trim() || undefined,
      certificateNumber: number.trim() || undefined,
      effectiveOn: effectiveOn.trim() || undefined,
      expiresOn: expiresOn.trim() || undefined,
      perOccurrenceLimitCents: dollarsToCents(perOcc),
      aggregateLimitCents: dollarsToCents(agg),
      deductibleCents: dollarsToCents(deductible),
      singleJobCapCents: dollarsToCents(singleJobCap),
      bondingAggregateCapCents: dollarsToCents(bondAggCap),
      bondRateBps: bondRate.trim()
        ? Math.round(Number(bondRate) * 10_000)
        : undefined,
      agentName: agentName.trim() || undefined,
      agentPhone: agentPhone.trim() || undefined,
      agentEmail: agentEmail.trim() || undefined,
      pdfUrl: pdfUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const isInsurance = INSURANCE_KINDS.includes(c.kind);
  const isBond = c.kind === 'BOND_PROFILE';
  const lvl = certificateExpiryLevel(c);
  const days = daysUntilExpiry(c);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {certificateKindLabel(c.kind)}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">{c.label}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {c.expiresOn ? (
              <>
                {t('cert.expires', { date: c.expiresOn })}
                {days !== undefined && (
                  <span
                    className={
                      lvl === 'expired'
                        ? 'ml-2 text-red-700 font-semibold'
                        : lvl === 'expiringSoon'
                          ? 'ml-2 text-yellow-700 font-semibold'
                          : 'ml-2 text-gray-500'
                    }
                  >
                    ({days < 0 ? t('cert.expiredAgo', { n: Math.abs(days) }) : t('cert.daysRemaining', { n: days })})
                  </span>
                )}
              </>
            ) : (
              t('cert.lifetime')
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={c.kind}
            onChange={(e) => void patch({ kind: e.target.value as CertificateKind })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {certificateKindLabel(k)}
              </option>
            ))}
          </select>
          <select
            value={c.status}
            onChange={(e) =>
              void patch({ status: e.target.value as CertificateStatus })
            }
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {certificateStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">{t('cert.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Identification */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cert.lblLabel')}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('cert.lblIssuer')}>
          <input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('cert.lblNumber')}>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('cert.lblPdf')}>
          <input
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            onBlur={saveAll}
            placeholder={t('cert.phPdf')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('cert.lblEffective')}>
          <input
            type="date"
            value={effectiveOn}
            onChange={(e) => setEffectiveOn(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('cert.lblExpiresOn')}>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            onBlur={saveAll}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Insurance limits */}
      {isInsurance && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {t('cert.headerInsLimits')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('cert.lblPerOcc')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={perOcc}
                onChange={(e) => setPerOcc(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('cert.lblAggLimit')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={agg}
                onChange={(e) => setAgg(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('cert.lblDeductible')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={deductible}
                onChange={(e) => setDeductible(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </section>
      )}

      {/* Bond fields */}
      {isBond && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {t('cert.headerBond')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('cert.lblSingleJobCap')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={singleJobCap}
                onChange={(e) => setSingleJobCap(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('cert.lblBondAggCap')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bondAggCap}
                onChange={(e) => setBondAggCap(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={t('cert.lblBondRate')}>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={bondRate}
                onChange={(e) => setBondRate(e.target.value)}
                onBlur={saveAll}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </section>
      )}

      {/* Agent contact */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('cert.headerAgent')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('cert.lblAgentName')}>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              onBlur={saveAll}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('cert.lblAgentPhone')}>
            <input
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              onBlur={saveAll}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('cert.lblAgentEmail')}>
            <input
              type="email"
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              onBlur={saveAll}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      </section>

      <Field label={t('cert.lblNotes')}>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveAll}
          placeholder={t('cert.phNotes')}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
