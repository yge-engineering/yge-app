// /backups — manifest snapshots of the persistent data root.
//
// Server component. Lists existing snapshots with a "Snapshot now"
// button + a freshness banner ('latest snapshot 6 hours ago' /
// 'no backup in the last 24 hours — take one now').

import {
  compareManifests,
  formatBytes,
  isBackupStale,
  summarizeBackups,
  type BackupDriftRow,
  type BackupManifest,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';
import { SnapshotButton } from './snapshot-button';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchBackups(): Promise<BackupManifest[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/backups`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { backups: BackupManifest[] }).backups ?? [];
  } catch {
    return [];
  }
}

const STALE_HOURS = 24;

const STATUS_TONE: Record<BackupManifest['status'], string> = {
  COMPLETE: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-gray-100 text-gray-700',
  FAILED: 'bg-red-100 text-red-800',
};

const DRIFT_TONE: Record<BackupDriftRow['status'], string> = {
  ADDED: 'bg-blue-50 text-blue-900',
  REMOVED: 'bg-red-50 text-red-900',
  CHANGED: 'bg-amber-50 text-amber-900',
  IDENTICAL: 'bg-gray-50 text-gray-600',
};

export default async function BackupsPage() {
  const backups = await fetchBackups();
  const overview = summarizeBackups(backups);
  const stale = isBackupStale(overview, STALE_HOURS);
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const latest = overview.latestCompleted;
  const priorCompleted =
    latest && backups.length > 1
      ? backups.find((b) => b.status === 'COMPLETE' && b.id !== latest.id) ?? null
      : null;
  const drift = latest ? compareManifests(priorCompleted, latest) : [];
  const changedRows = drift.filter((d) => d.status !== 'IDENTICAL');

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Backups"
          subtitle="Manifest snapshots of the persistent data root. Each snapshot records per-store file counts, total bytes, and a content fingerprint so the office can spot drift."
        />

        {stale ? (
          <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            No completed snapshot in the last {STALE_HOURS} hours.{' '}
            {overview.ageOfLatestHours === null
              ? 'Take one now to protect against accidental data loss.'
              : `Latest is ${overview.ageOfLatestHours}h old.`}
          </p>
        ) : (
          <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
            Latest snapshot is {overview.ageOfLatestHours}h old. Good shape.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-4">
            <Tile label="Snapshots" value={String(overview.total)} />
            <Tile
              label="Latest items"
              value={latest ? String(latest.totalItems) : '—'}
            />
            <Tile
              label="Latest size"
              value={latest ? formatBytes(latest.totalBytes) : '—'}
            />
            <Tile
              label="Latest taken"
              value={latest ? latest.label : '—'}
            />
          </div>
          <SnapshotButton apiBaseUrl={publicApiUrl} />
        </div>

        {latest && changedRows.length > 0 && (
          <section className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-amber-900">
              Drift vs the prior completed snapshot ({changedRows.length} change{changedRows.length === 1 ? '' : 's'})
            </h2>
            <table className="mt-2 w-full text-left text-xs">
              <thead className="text-xs uppercase tracking-wide text-amber-900/70">
                <tr>
                  <th className="py-1">Status</th>
                  <th className="py-1">Component</th>
                  <th className="py-1 text-right">Item Δ</th>
                  <th className="py-1 text-right">Bytes Δ</th>
                </tr>
              </thead>
              <tbody>
                {changedRows.map((d) => (
                  <tr key={`${d.name}-${d.status}`} className="border-t border-amber-200">
                    <td className="py-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${DRIFT_TONE[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-1 font-mono">{d.name}</td>
                    <td className={`py-1 text-right font-mono ${d.itemDelta < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {d.itemDelta > 0 ? '+' : ''}
                      {d.itemDelta}
                    </td>
                    <td className={`py-1 text-right font-mono ${d.bytesDelta < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {d.bytesDelta > 0 ? '+' : ''}
                      {formatBytes(Math.abs(d.bytesDelta))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Snapshot history</h2>
          {backups.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No snapshots yet. Hit "Snapshot now" above.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2">Label</th>
                  <th className="py-2">Taken</th>
                  <th className="py-2">Triggered by</th>
                  <th className="py-2 text-right">Items</th>
                  <th className="py-2 text-right">Size</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Components</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-t border-gray-200">
                    <td className="py-2 font-medium text-gray-900">{b.label}</td>
                    <td className="py-2 font-mono text-xs text-gray-700">
                      {b.takenAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2 text-xs text-gray-700">{b.triggeredBy}</td>
                    <td className="py-2 text-right font-mono">{b.totalItems}</td>
                    <td className="py-2 text-right font-mono">{formatBytes(b.totalBytes)}</td>
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[b.status]}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-600">{b.components.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </AppShell>
  );
}
