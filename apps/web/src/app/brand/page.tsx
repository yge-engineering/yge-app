// /brand — YGE brand kit reference page.
//
// Shows logos, colors, typography, and the address/license block in one
// place. Useful when a print shop or designer needs the official tokens
// for letterhead, business cards, vehicle decals, jobsite signage, etc.
// Also doubles as a self-test for the <Letterhead> component.

import Link from 'next/link';
import { YGE_COMPANY_INFO } from '@yge/shared';
import { Letterhead } from '@/components/letterhead';

interface ColorSwatch {
  name: string;
  hex: string;
  /** Tailwind class so the swatch renders without inline styles. */
  cls: string;
  description: string;
}

const COLORS: ColorSwatch[] = [
  {
    name: 'YGE Blue 500',
    hex: '#1f4e78',
    cls: 'bg-yge-blue-500',
    description: 'Primary brand color. Used for headings, buttons, and the letterhead bar.',
  },
  {
    name: 'YGE Blue 700',
    hex: '#163a5a',
    cls: 'bg-yge-blue-700',
    description: 'Hover + active state for primary buttons; deep accent on the logo.',
  },
  {
    name: 'YGE Accent 500',
    hex: '#2e75b6',
    cls: 'bg-yge-accent-500',
    description: 'Secondary accent for tagline text and decorative strokes.',
  },
  {
    name: 'YGE Blue 200',
    hex: '#bfdbfe',
    cls: 'bg-yge-blue-200',
    description: 'Light tints used on inset backgrounds and dividers.',
  },
  {
    name: 'YGE Blue 50',
    hex: '#eff6ff',
    cls: 'bg-yge-blue-50',
    description: 'Page wash / banner background for low-emphasis information.',
  },
];

export default function BrandPage() {
  const company = YGE_COMPANY_INFO;
  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="text-xs text-gray-500">
          Phase-1 placeholder kit &middot; swap for designer-final assets when
          they land
        </div>
      </div>

      <header>
        <h1 className="text-3xl font-bold text-yge-blue-500">YGE brand kit</h1>
        <p className="mt-2 text-gray-700">
          Logos, colors, typography, and the standard letterhead block. Every
          printable page in the app pulls from these tokens, so updating this
          page (or replacing the SVG files in <code>/public</code>) cascades
          across cover letters, bid summaries, envelope checklists, and
          rosters.
        </p>
      </header>

      {/* ---------- Logos ---------- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900">Logos</h2>
        <p className="mt-1 text-sm text-gray-600">
          Drop-in replaceable: save a designer-final SVG over the file at
          the same path and every consumer picks it up.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/yge-logo.svg"
              alt="YGE square logo"
              className="mx-auto h-32 w-32"
            />
            <div className="mt-3 text-xs text-gray-500">/yge-logo.svg</div>
            <div className="mt-1 text-xs font-medium text-gray-700">
              Square mark
            </div>
            <div className="text-xs text-gray-500">
              For favicons, social avatars, square signage
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/yge-logo-horizontal.svg"
              alt="YGE horizontal lockup"
              className="h-24 w-auto"
            />
            <div className="mt-3 text-xs text-gray-500">
              /yge-logo-horizontal.svg
            </div>
            <div className="mt-1 text-xs font-medium text-gray-700">
              Horizontal lockup
            </div>
            <div className="text-xs text-gray-500">
              For letterhead headers, email signatures, vehicle decals
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Colors ---------- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900">Colors</h2>
        <p className="mt-1 text-sm text-gray-600">
          Defined in <code>apps/web/tailwind.config.ts</code> &mdash; reference
          them via the Tailwind class names below.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLORS.map((c) => (
            <div
              key={c.name}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className={`${c.cls} h-20 w-full`} aria-hidden />
              <div className="p-4">
                <div className="font-medium text-gray-900">{c.name}</div>
                <div className="font-mono text-xs text-gray-600">{c.hex}</div>
                <div className="mt-1 font-mono text-xs text-yge-blue-500">
                  {c.cls}
                </div>
                <p className="mt-2 text-xs text-gray-600">{c.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Typography ---------- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900">Typography</h2>
        <p className="mt-1 text-sm text-gray-600">
          Inter is the default sans family across the app and the printables.
          Pair with a heavy weight (700-800) for headings, regular (400-500)
          for body, semi (600) for labels and metadata strips.
        </p>
        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-3xl font-bold text-yge-blue-500">
            Heading 1 / 30px / 700
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            Heading 2 / 24px / 600
          </div>
          <div className="text-lg font-semibold text-gray-900">
            Heading 3 / 18px / 600
          </div>
          <div className="text-base text-gray-800">
            Body copy / 16px / 400 &mdash; the default reading size used for
            paragraph text in the cover letter and bid summary.
          </div>
          <div className="text-sm text-gray-700">
            Body small / 14px / 400 &mdash; table rows, footnotes, metadata.
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Label / 12px / 500 / uppercase / wide tracking
          </div>
        </div>
      </section>

      {/* ---------- Address block ---------- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900">Standard address block</h2>
        <p className="mt-1 text-sm text-gray-600">
          Pulled from <code>YGE_COMPANY_INFO</code> in <code>@yge/shared</code>.
          Update the constant once, every printable updates.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <pre className="overflow-x-auto rounded border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-800">
{`${company.legalName}
${company.address.street}
${company.address.city}, ${company.address.state} ${company.address.zip}

CSLB #${company.cslbLicense}
DIR #${company.dirNumber}
DOT #${company.dotNumber}
NAICS: ${company.naicsCodes.join(', ')}
PSC: ${company.pscCodes.join(', ')}

President: ${company.president.name} (${company.president.phone})
Vice President: ${company.vicePresident.name} (${company.vicePresident.phone})`}
          </pre>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <Letterhead variant="compact" />
            <p className="mt-3 text-xs text-gray-500">
              Live <code>&lt;Letterhead variant=&quot;compact&quot; /&gt;</code>
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Full letterhead preview ---------- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900">Full letterhead</h2>
        <p className="mt-1 text-sm text-gray-600">
          Used at the top of cover letters and bid summaries.
        </p>
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <Letterhead />
        </div>
      </section>
    </main>
  );
}
