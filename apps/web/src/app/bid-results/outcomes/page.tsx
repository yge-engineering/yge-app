import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string; tone: 'good' | 'bad' | 'warn' | 'neutral' }

const CARDS: Card[] = [
  { href: '/bid-results/wins', title: 'Wins', description: 'WON_BY_YGE', tone: 'good' },
  { href: '/bid-results/losses', title: 'Losses', description: 'WON_BY_OTHER', tone: 'bad' },
  { href: '/bid-results/tbd', title: 'TBD', description: 'Awaiting outcome', tone: 'warn' },
  { href: '/bid-results/no-award', title: 'No award', description: 'NO_AWARD', tone: 'neutral' },
  { href: '/bid-results/apparent-lows', title: 'Apparent lows', description: 'YGE was rank #1', tone: 'good' },
  { href: '/bid-results/biggest-wins', title: 'Biggest wins', description: 'Top 25 by amount', tone: 'good' },
  { href: '/bid-results/closest-misses', title: 'Closest misses', description: 'Smallest gap to winner', tone: 'warn' },
  { href: '/bid-results/with-multiple-bidders', title: 'Competitive tabs', description: '> 1 bidder', tone: 'neutral' },
];

const TONE_CLASS: Record<Card['tone'], string> = {
  good: 'border-green-200 bg-green-50 hover:bg-green-100',
  bad: 'border-red-200 bg-red-50 hover:bg-red-100',
  warn: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
  neutral: 'border-gray-200 bg-white hover:bg-gray-50',
};

export default function OutcomesHubPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bid result filters" subtitle="One screen with every outcome filter / leaderboard for bid results." />
        <div className="grid gap-3 sm:grid-cols-2">
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
