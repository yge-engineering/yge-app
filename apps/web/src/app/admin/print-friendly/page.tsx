import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/help/cheatsheet', title: 'Help cheat sheet', description: 'Print and tape to monitor — daily/weekly/quarterly routines.' },
  { href: '/admin/cheatsheet', title: 'Admin cheat sheet', description: 'Print and tape to monitor — admin task locations.' },
  { href: '/portfolio', title: 'Portfolio overview', description: 'Lifetime + pipeline + master data on one page.' },
  { href: '/at-a-glance', title: 'At a glance', description: 'Command center tiles.' },
  { href: '/about', title: 'About YGE', description: 'Company facts + licensing — handy for proposals.' },
];

export default function PrintFriendlyPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Print-friendly pages" subtitle="Pages that look good on paper. Cmd-P / Ctrl-P prints any of them." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {CARDS.map((c) => (
            <li key={c.href} className="px-4 py-3">
              <Link href={c.href} className="text-sm font-semibold text-yge-blue-700 hover:underline">{c.title}</Link>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">{c.href}</div>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
