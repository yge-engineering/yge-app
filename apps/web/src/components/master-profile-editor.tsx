// Master-profile inline editor.
//
// Client island. Loads the current profile as initial state, lets
// the operator edit identity / address / contact / DBE flags, and
// PATCHes /api/master-profile on save. Officers / insurance /
// bonding edit through their own dedicated forms in subsequent
// commits — they're list-of-rows shapes that need add/remove
// affordances.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MasterProfile } from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  initial: MasterProfile;
}

type Patch = Partial<MasterProfile> & {
  address?: Partial<MasterProfile['address']>;
};

export function MasterProfileEditor({ apiBaseUrl, initial }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<MasterProfile>(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function setField<K extends keyof MasterProfile>(key: K, value: MasterProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setAddressField<K extends keyof MasterProfile['address']>(
    key: K,
    value: MasterProfile['address'][K],
  ) {
    setDraft((d) => ({ ...d, address: { ...d.address, [key]: value } }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      // Send only the editable surface to keep the patch small.
      const patch: Patch = {
        legalName: draft.legalName,
        shortName: draft.shortName,
        cslbLicense: draft.cslbLicense,
        cslbExpiresOn: draft.cslbExpiresOn,
        cslbClassifications: draft.cslbClassifications,
        dirNumber: draft.dirNumber,
        dirExpiresOn: draft.dirExpiresOn,
        dotNumber: draft.dotNumber,
        caMcpNumber: draft.caMcpNumber,
        federalEin: draft.federalEin,
        caEntityNumber: draft.caEntityNumber,
        caEmployerAccountNumber: draft.caEmployerAccountNumber,
        naicsCodes: draft.naicsCodes,
        pscCodes: draft.pscCodes,
        primaryPhone: draft.primaryPhone,
        primaryFax: draft.primaryFax,
        primaryEmail: draft.primaryEmail,
        websiteUrl: draft.websiteUrl,
        address: draft.address,
        isDbe: draft.isDbe,
        isSbe: draft.isSbe,
        isDvbe: draft.isDvbe,
        isWbe: draft.isWbe,
        notes: draft.notes,
      };
      // Strip undefineds so we don't land empty/optional clears.
      for (const k of Object.keys(patch) as Array<keyof Patch>) {
        if (patch[k] === undefined || patch[k] === '') delete patch[k];
      }
      const res = await fetch(`${apiBaseUrl}/api/master-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `API returned ${res.status}`);
        return;
      }
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Edit profile
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name">
          <input
            type="text"
            value={draft.legalName}
            onChange={(e) => setField('legalName', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Short name">
          <input
            type="text"
            value={draft.shortName}
            onChange={(e) => setField('shortName', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="CSLB license #" required>
          <input
            type="text"
            value={draft.cslbLicense}
            onChange={(e) => setField('cslbLicense', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="CSLB expires (yyyy-mm-dd)">
          <input
            type="date"
            value={draft.cslbExpiresOn ?? ''}
            onChange={(e) => setField('cslbExpiresOn', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="CSLB classifications (comma-separated)">
          <input
            type="text"
            value={draft.cslbClassifications.join(', ')}
            onChange={(e) =>
              setField(
                'cslbClassifications',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
            className={inputClass}
            placeholder="A, C-12"
          />
        </Field>
        <Field label="DIR registration #" required>
          <input
            type="text"
            value={draft.dirNumber}
            onChange={(e) => setField('dirNumber', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="DIR expires">
          <input
            type="date"
            value={draft.dirExpiresOn ?? ''}
            onChange={(e) => setField('dirExpiresOn', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="DOT #">
          <input
            type="text"
            value={draft.dotNumber ?? ''}
            onChange={(e) => setField('dotNumber', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="Federal EIN (XX-XXXXXXX)">
          <input
            type="text"
            value={draft.federalEin ?? ''}
            onChange={(e) => setField('federalEin', e.target.value || undefined)}
            className={inputClass}
            placeholder="12-3456789"
          />
        </Field>
        <Field label="CA SOS entity #">
          <input
            type="text"
            value={draft.caEntityNumber ?? ''}
            onChange={(e) => setField('caEntityNumber', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="CA employer account #">
          <input
            type="text"
            value={draft.caEmployerAccountNumber ?? ''}
            onChange={(e) => setField('caEmployerAccountNumber', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="CA MCP #">
          <input
            type="text"
            value={draft.caMcpNumber ?? ''}
            onChange={(e) => setField('caMcpNumber', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="NAICS codes (comma-separated)">
          <input
            type="text"
            value={draft.naicsCodes.join(', ')}
            onChange={(e) =>
              setField(
                'naicsCodes',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
            className={inputClass}
            placeholder="115310"
          />
        </Field>
        <Field label="PSC codes (comma-separated)">
          <input
            type="text"
            value={draft.pscCodes.join(', ')}
            onChange={(e) =>
              setField(
                'pscCodes',
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              )
            }
            className={inputClass}
            placeholder="F003, F004"
          />
        </Field>
      </div>

      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Address + contact
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street" required>
          <input
            type="text"
            value={draft.address.street}
            onChange={(e) => setAddressField('street', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Suite / unit">
          <input
            type="text"
            value={draft.address.street2 ?? ''}
            onChange={(e) => setAddressField('street2', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="City" required>
          <input
            type="text"
            value={draft.address.city}
            onChange={(e) => setAddressField('city', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="State (2 letters)" required>
          <input
            type="text"
            value={draft.address.state}
            maxLength={2}
            onChange={(e) => setAddressField('state', e.target.value.toUpperCase())}
            className={inputClass}
          />
        </Field>
        <Field label="ZIP" required>
          <input
            type="text"
            value={draft.address.zip}
            onChange={(e) => setAddressField('zip', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="County">
          <input
            type="text"
            value={draft.address.county ?? ''}
            onChange={(e) => setAddressField('county', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="Phone" required>
          <input
            type="tel"
            value={draft.primaryPhone}
            onChange={(e) => setField('primaryPhone', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Fax">
          <input
            type="tel"
            value={draft.primaryFax ?? ''}
            onChange={(e) => setField('primaryFax', e.target.value || undefined)}
            className={inputClass}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={draft.primaryEmail}
            onChange={(e) => setField('primaryEmail', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={draft.websiteUrl ?? ''}
            onChange={(e) => setField('websiteUrl', e.target.value || undefined)}
            className={inputClass}
            placeholder="https://youngge.com"
          />
        </Field>
      </div>

      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Diversity certifications
      </h3>
      <div className="flex flex-wrap gap-4">
        <CheckboxField label="DBE" checked={draft.isDbe} onChange={(v) => setField('isDbe', v)} />
        <CheckboxField label="SBE" checked={draft.isSbe} onChange={(v) => setField('isSbe', v)} />
        <CheckboxField label="DVBE" checked={draft.isDvbe} onChange={(v) => setField('isDvbe', v)} />
        <CheckboxField label="WBE" checked={draft.isWbe} onChange={(v) => setField('isWbe', v)} />
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="rounded bg-yge-blue-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-700">
            ✓ Saved at {savedAt.replace('T', ' ').slice(0, 16)} UTC
          </span>
        )}
        {dirty && !busy && !savedAt && (
          <span className="text-xs text-gray-500">Unsaved changes.</span>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Officers, bonding, and insurance edit through dedicated forms in
        subsequent commits — those are list-of-rows shapes that need add /
        remove affordances. Today they edit through PATCH /api/master-profile
        directly.
      </p>
    </section>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-1 font-medium text-gray-700">
        {label}
        {required && <span className="text-xs text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-gray-800">{label}</span>
    </label>
  );
}
