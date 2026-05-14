import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Card { href: string; title: string; description: string }

const CARDS: Card[] = [
  { href: '/help', title: 'Help / FAQ', description: 'Common questions, collapsible.' },
  { href: '/help/getting-started', title: 'Getting started', description: 'Six-step onboarding for new users.' },
  { href: '/help/glossary', title: 'Glossary', description: 'Plain-English term definitions.' },
  { href: '/help/cheatsheet', title: 'Cheat sheet', description: 'Print and tape to monitor.' },
  { href: '/admin/help', title: 'Admin help', description: 'Admin task FAQ.' },
  { href: '/admin/cheatsheet', title: 'Admin cheat sheet', description: 'Where to go for any admin task.' },
  { href: '/admin/yge-context', title: 'YGE context', description: 'One-screen orientation.' },
  { href: '/admin/quick-look', title: 'Quick look', description: 'Prose summary of the app.' },
  { href: '/keyboard-shortcuts', title: 'Keyboard shortcuts', description: 'Keyboard reference.' },
  { href: '/about', title: 'About YGE', description: 'Company facts + licensing.' },
  { href: '/changelog', title: 'Changelog', description: 'Recent shipped features.' },
  { href: '/admin/release-history', title: 'Release history', description: 'Timeline of ships.' },
];

export default function HelpPagesIndexPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Help + docs index" subtitle={`${CARDS.length} pages that explain things.`} />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{c.title}</div>
              <div className="text-xs text-gray-600">{c.description}</div>
              <div className="mt-1 font-mono text-[10px] text-gray-400">{c.href}</div>
            </Link>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
