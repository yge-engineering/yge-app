// /admin/extension-test — sandbox page for the browser extension.
//
// Plain English: open this page in Chrome with the YGE Auto Form
// Filler extension loaded, click the extension icon, then Scan +
// Apply. The fields below mimic the shapes you'll see on Caltrans
// BidExpress / Cal eProcure / county vendor portals / ACORD COI
// requests — id, name, placeholder, and label combinations that
// the matcher should pick up.
//
// Renders as a plain HTML form (no submit handler) so the extension
// is the only thing writing values. Anything that gets filled here
// is proof the matcher works.

import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function ExtensionTestPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <PageHeader
          title="Extension test sandbox"
          subtitle="Form fields shaped like the ones the YGE Auto Form Filler extension targets in the wild. Open the extension popup → Scan → Apply to verify."
        />
        <section className="rounded border border-yge-blue-200 bg-yge-blue-50 p-3 text-xs text-yge-blue-900">
          <strong>How to use:</strong> Load the extension via <code className="rounded bg-white px-1">chrome://extensions/ → Developer mode → Load unpacked → apps/browser-extension/dist</code>.
          {' '}Then click its icon in this tab and hit <em>Scan</em>. You should see ~12-16 matches — tick the ones you want and click Apply.
        </section>

        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <FormField id="legalName" label="Legal company name" placeholder="Company name" />
          <FormField id="dba" label="DBA (doing business as)" placeholder="Short name" />
          <FormField id="cslbLic" name="cslb_license_no" label="CSLB License #" placeholder="License number" />
          <FormField id="dirReg" name="dir_registration_number" label="DIR Public Works Registration" placeholder="DIR #" />
          <FormField id="dotNum" name="usdot" label="USDOT Number" placeholder="DOT #" />
          <FormField id="ein" name="federal_tax_id" label="Federal EIN" placeholder="EIN" />
          <FormField id="sosEntity" name="ca_sos_entity_id" label="CA Secretary of State entity #" />
          <FormField id="eddAcct" name="employer_account" label="CA EDD employer account" />
          <FormField id="addr1" name="address_line_1" label="Street address" placeholder="Address" />
          <FormField id="addr2" name="address_line_2" label="Suite / unit (optional)" />
          <FormField id="city" name="city" label="City" />
          <FormField id="state" name="state" label="State" placeholder="2-letter" />
          <FormField id="zip" name="postal_code" label="ZIP code" placeholder="ZIP" />
          <FormField id="phone" name="contact_phone" label="Phone" placeholder="Phone" />
          <FormField id="email" name="contact_email" label="Email" type="email" />
          <FormField id="web" name="company_website" label="Website" type="url" />
          <FormField id="naics" name="naics_codes" label="NAICS code(s)" placeholder="115310, ..." />
          <FormField id="psc" name="psc_codes" label="PSC code(s)" placeholder="F003, F004" />
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Tip: fields already containing text are skipped by default. Refresh this page to clear and try again. Low-confidence matches (under 60%) ship unticked so you opt in deliberately.
        </p>
      </main>
    </AppShell>
  );
}

function FormField({
  id,
  name,
  label,
  placeholder,
  type = 'text',
}: {
  id: string;
  name?: string;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        id={id}
        name={name ?? id}
        type={type}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
