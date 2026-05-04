'use client';

// /certificates/new — minimal create form. After save, jump to the edit
// page where the user fills in kind-specific fields.

import { useState } from 'react';
import Link from 'next/link';
import { useTranslator } from '../../../lib/use-translator';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  certificateKindLabel,
  type Certificate,
  type CertificateKind,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

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

export default function NewCertificatePage() {
  const router = useRouter();
  const t = useTranslator();
  const [kind, setKind] = useState<CertificateKind>('GENERAL_LIABILITY');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (label.trim().length === 0) {
      setError(t('newCert.errLabelRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ certificate: Certificate }>('/api/certificates', {
        kind,
        label: label.trim(),
      });
      router.push(`/certificates/${res.certificate.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('newCert.errHttp', { message: err.message, status: err.status }));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('newCert.errUnknown'));
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/certificates" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCert.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newCert.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newCert.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('newCert.lblKind')}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CertificateKind)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {certificateKindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('newCert.lblLabel')}>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('newCert.phLabel')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? t('newCert.busy') : t('newCert.action')}
          </button>
          <Link href="/certificates" className="text-sm text-gray-600 hover:underline">
            {t('newCert.cancel')}
          </Link>
        </div>
      </form>
    </main>
    </AppShell>
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
