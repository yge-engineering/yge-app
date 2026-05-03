// /print — index of print-ready views.
//
// Plain English: a directory of every page that's designed to print
// clean (no AppShell chrome). Use it when you want to verify the
// letterhead before printing, or to find a print version of
// something you have on screen.

import { AppShell, Card, LinkButton, PageHeader } from '../../components';
import { getTranslator } from '../../lib/locale';

interface PrintLink {
  label: string;
  href: string;
  blurb: string;
  example?: boolean;
}

const PRINT_LINKS: PrintLink[] = [
  {
    label: 'Letterhead test',
    href: '/print/letterhead-test',
    blurb: 'Sample letter on YGE letterhead. Verify the header / footer / margins look right before you print real documents.',
    example: true,
  },
  {
    label: 'Bid transmittal',
    href: '/estimates/[id]/transmittal',
    blurb: 'Cover letter for a bid envelope. Open an estimate first, then click Print transmittal.',
  },
  {
    label: 'Bid envelope checklist',
    href: '/estimates/[id]/envelope',
    blurb: 'Last-mile manifest of every document that goes in the envelope. Required-but-missing items print red.',
  },
  {
    label: 'Sub list (PCC §4104)',
    href: '/estimates/[id]/sub-list',
    blurb: 'CA public-works subcontractor listing — every sub doing >0.5% of the bid (or >$10K floor).',
  },
  {
    label: 'Addenda acknowledgments',
    href: '/estimates/[id]/addenda',
    blurb: 'Page where each addendum is acknowledged. Un-acked items print red.',
  },
  {
    label: 'Bid print packet',
    href: '/estimates/[id]/print',
    blurb: 'Full priced estimate ready to print as the bid form.',
  },
  {
    label: 'Lien waiver',
    href: '/lien-waivers/[id]/print',
    blurb: 'CC §8132 / §8134 / §8136 / §8138 statutory waiver forms ready to sign.',
  },
  {
    label: 'Certified payroll (A-1-131)',
    href: '/certified-payrolls/[id]',
    blurb: 'Public-works payroll form. Pulls hours, classifications, and DIR rates automatically.',
  },
  {
    label: 'Dispatch handout',
    href: '/dispatch/[id]/handout',
    blurb: 'Single-page yard handout — meet time, scope, crew, equipment, foreman phone.',
  },
];

export default function PrintIndexPage() {
  const t = getTranslator();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader
          title={t('print.title')}
          subtitle={t('print.subtitle')}
        />

        <div className="space-y-3">
          {PRINT_LINKS.map((p) => (
            <Card key={p.href}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">{p.label}</h2>
                  <p className="mt-1 text-sm text-gray-700">{p.blurb}</p>
                  <code className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">
                    {p.href}
                  </code>
                </div>
                {p.example ? (
                  <LinkButton href={p.href} variant="primary" size="sm">
                    {t('print.openExample')}
                  </LinkButton>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
