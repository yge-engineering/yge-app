import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }

const CARDS: Card[] = [
  { href: '/jobs/prospect', title: 'Prospect', description: 'Early-stage opportunities', tone: 'neutral' },
  { href: '/jobs/pursuing', title: 'Pursuing', description: 'Actively chasing the bid', tone: 'neutral' },
  { href: '/jobs/bid-submitted', title: 'Bid submitted', description: 'Waiting on agency decision', tone: 'warn' },
  { href: '/jobs/awarded', title: 'Awarded', description: 'Won and not yet active', tone: 'good' },
  { href: '/jobs/active', title: 'Active', description: 'Currently in execution', tone: 'good' },
  { href: '/jobs/closed', title: 'Closed', description: 'Wrapped up and accepted', tone: 'good' },
  { href: '/jobs/lost', title: 'Lost', description: 'Bid did not go our way', tone: 'bad' },
  { href: '/jobs/no-bid', title: 'No-bid', description: 'We passed on the project', tone: 'neutral' },
  { href: '/jobs/archived', title: 'Archived', description: 'Cold storage', tone: 'neutral' },
];

const TONE_CLASS: Record<Card['tone'], string> = {
  good: 'border-green-200 bg-green-50 hover:bg-green-100',
  bad: 'border-red-200 bg-red-50 hover:bg-red-100',
  warn: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
  neutral: 'border-gray-200 bg-white hover:bg-gray-50',
};

export default function JobStatusesHubPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Jobs by status" subtitle="One screen with a card for each job status." />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className={`block rounded-lg border p-3 shadow-sm ${TONE_CLASS[c.tone]}`}>
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
