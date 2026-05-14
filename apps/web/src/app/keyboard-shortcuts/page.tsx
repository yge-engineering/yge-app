import { AppShell, PageHeader } from '../../components';

interface Shortcut { keys: string; description: string; context: string }

const SHORTCUTS: Shortcut[] = [
  { keys: 'J / K', description: 'Move selection down / up in a list or table', context: 'Estimates, Bid results, Jobs' },
  { keys: '/', description: 'Focus the page-level search input', context: 'Estimates, Bid results' },
  { keys: 'Enter', description: 'Open the currently-highlighted row', context: 'Estimates, Bid results, Jobs' },
  { keys: 'Esc', description: 'Cancel an open modal or clear focus', context: 'Modals' },
  { keys: 'Ctrl+S', description: 'Save the current form (where supported)', context: 'Estimate editor' },
  { keys: 'Ctrl+P', description: 'Open the print preview / bid PDF', context: 'Estimate detail' },
];

export default function KeyboardShortcutsPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Keyboard shortcuts" subtitle="Quick reference for the keyboard-driven flows in the app." />

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">Keys</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Where it works</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs"><kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5">{s.keys}</kbd></td>
                  <td className="px-3 py-2">{s.description}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.context}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Shortcuts are case-insensitive and use Cmd on macOS, Ctrl on Windows / Linux.
        </p>
      </main>
    </AppShell>
  );
}
