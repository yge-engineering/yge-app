import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Shortcut { keys: string; description: string; context: string }

const SHORTCUTS: Shortcut[] = [
  { keys: 'J / K', description: 'Move selection down / up in any J-K-enabled list', context: 'Bid results, Estimates, Jobs' },
  { keys: '/', description: 'Focus the page-level search input', context: 'Search-enabled pages' },
  { keys: 'Enter', description: 'Open the highlighted row', context: 'List pages' },
  { keys: 'Esc', description: 'Close modal or clear focus', context: 'Modals' },
  { keys: 'Cmd / Ctrl + P', description: 'Print the current page', context: 'Any page' },
  { keys: 'Cmd / Ctrl + S', description: 'Save the current form (where supported)', context: 'Estimate editor' },
  { keys: 'Cmd / Ctrl + K', description: 'Open global search (future)', context: '(planned)' },
];

export default function AdminKeyboardShortcutsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin keyboard shortcuts" subtitle="Keyboard shortcuts the YGE app honors." />
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Keys</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Context</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">{s.keys}</kbd>
                  </td>
                  <td className="px-3 py-2 text-sm">{s.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
