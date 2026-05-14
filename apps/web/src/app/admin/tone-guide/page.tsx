import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Rule { title: string; description: string; example?: string }

const RULES: Rule[] = [
  {
    title: 'Plain English',
    description: 'Write documentation, error messages, UI copy, commit messages in plain English. No jargon a heavy-civil contractor would not use.',
    example: 'Use "Estimate" not "Proposal record".',
  },
  {
    title: 'Short by default',
    description: 'Page subtitles in one sentence. Body copy uses short paragraphs. Tables for dense lists; cards for browsing.',
  },
  {
    title: 'Empty states encourage, not scold',
    description: 'Acknowledge that the empty state can be a good thing.',
    example: '"Every customer has an email. Nice." — better than "0 customers missing email."',
  },
  {
    title: 'Buttons say what they do',
    description: 'Use verbs that describe the outcome.',
    example: '"Open in Mail", "Run all", "Download CSV". Never "Submit" alone.',
  },
  {
    title: 'Numbers stay monospace',
    description: 'Money, counts, dates, IDs — all monospace. Names + descriptions are proportional.',
  },
  {
    title: 'No exclamation marks',
    description: 'Punctuation is functional, not decorative.',
  },
];

export default function ToneGuidePage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Tone guide" subtitle="Copywriting conventions used across the YGE app." />
        <ul className="space-y-3">
          {RULES.map((r, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{r.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{r.description}</p>
              {r.example ? (
                <p className="mt-2 rounded bg-yge-blue-50 p-2 text-xs text-yge-blue-700">{r.example}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
