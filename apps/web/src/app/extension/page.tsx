// /extension — install + usage docs for the YGE Form Filler
// browser extension. Surfaces the same info as the INSTALL.md
// in extensions/yge-form-filler/ but on the web so office
// staff can find it without spelunking the repo.

import Link from 'next/link';

import { AppShell, PageHeader } from '../../components';

export default function ExtensionPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
        <PageHeader
          title="YGE Form Filler extension"
          subtitle="The browser extension that auto-fills agency bid forms from the master profile."
        />

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            What it does
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-700">
            <li>
              Scans every form on the current page and flags which
              fields it recognizes from the YGE master profile.
            </li>
            <li>
              On the "Fill matched fields" click, writes the right
              values into name, license number, DIR, DOT, address,
              phone, email, officer, signer, and dozens of other
              recognized field types.
            </li>
            <li>
              Supports text inputs, select dropdowns, checkboxes,
              and radio buttons. Undo reverses the last fill.
            </li>
            <li>
              Allowed origins include <code>*.dir.ca.gov</code>,{' '}
              <code>*.fire.ca.gov</code>, <code>*.dot.ca.gov</code>,{' '}
              <code>*.cslb.ca.gov</code>, plus the seven NorCal
              county procurement domains (Shasta, Tehama, Glenn,
              Butte, Yuba, Sutter, Colusa).
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Install
          </h2>

          <h3 className="mt-4 text-sm font-bold text-gray-900">
            Chrome / Edge (developer mode)
          </h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">
            <li>
              Open <code>chrome://extensions/</code>
            </li>
            <li>Toggle "Developer mode" on (top-right).</li>
            <li>Click "Load unpacked".</li>
            <li>
              Select{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                yge-app/extensions/yge-form-filler/
              </code>
            </li>
            <li>Pin the "YGE Form Filler" icon to the toolbar.</li>
          </ol>

          <h3 className="mt-4 text-sm font-bold text-gray-900">Firefox</h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">
            <li>
              Open <code>about:debugging#/runtime/this-firefox</code>
            </li>
            <li>Click "Load Temporary Add-on".</li>
            <li>
              Select{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                manifest.json
              </code>{' '}
              in the extension directory.
            </li>
            <li>
              Note: Firefox reloads the extension every restart. Use a
              self-signed XPI for persistence.
            </li>
          </ol>

          <h3 className="mt-4 text-sm font-bold text-gray-900">
            Safari (requires Xcode)
          </h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">
            <li>Open Xcode → File → New → Project → Safari Extension App.</li>
            <li>Point the resources folder at the extension directory.</li>
            <li>Sign with a Developer ID and run.</li>
          </ol>
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Configure
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            The popup shows the configured API URL (default{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              https://api.youngge.com
            </code>
            ). Click "edit" to point it at a staging API or
            localhost. The popup also shows the API build SHA + AI
            prompt version, the snapshot age, and how many master-
            profile fields are populated.
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Troubleshooting
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-700">
            <li>
              "API unreachable" in red → the popup can&apos;t reach{' '}
              <code>/api/version</code>. Check the configured URL
              and that the API host is up. See{' '}
              <Link href="/api-status" className="text-yge-blue-500 hover:underline">
                /api-status
              </Link>
              .
            </li>
            <li>
              Field matched but didn&apos;t fill → the master
              profile field is empty. Open the{' '}
              <Link href="/master-profile" className="text-yge-blue-500 hover:underline">
                master profile
              </Link>{' '}
              and check the extension-snapshot tile; it lists any
              empty fields.
            </li>
            <li>
              Snapshot is stale (an edit on the master profile
              isn&apos;t showing on a form) → click "Refresh
              snapshot" in the popup.
            </li>
            <li>
              "Click to view raw snapshot JSON" in the popup opens{' '}
              <code>/api/extension/profile-snapshot</code> in a tab
              so you can eyeball exactly what the extension sees.
            </li>
          </ul>
        </section>

        <p className="mt-6 text-xs text-gray-500">
          See also:{' '}
          <Link href="/master-profile" className="text-yge-blue-500 hover:underline">
            /master-profile
          </Link>
          ,{' '}
          <Link href="/pdf-forms" className="text-yge-blue-500 hover:underline">
            /pdf-forms
          </Link>
          ,{' '}
          <Link href="/admin/version" className="text-yge-blue-500 hover:underline">
            /admin/version
          </Link>
          .
        </p>
      </main>
    </AppShell>
  );
}
