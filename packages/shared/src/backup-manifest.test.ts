import { describe, it, expect } from 'vitest';
import {
  BackupManifestSchema,
  compareManifests,
  defaultBackupLabel,
  formatBytes,
  isBackupStale,
  newBackupId,
  summarizeBackups,
  type BackupManifest,
} from './backup-manifest';

function manifest(over: Partial<BackupManifest> = {}): BackupManifest {
  return BackupManifestSchema.parse({
    id: 'bkp-deadbeef',
    takenAt: '2026-05-23T15:00:00Z',
    completedAt: '2026-05-23T15:00:05Z',
    label: '2026-05-23-1500',
    triggeredBy: 'auto',
    status: 'COMPLETE',
    components: [
      {
        kind: 'FILE_STORE',
        name: 'vendors',
        itemCount: 142,
        totalBytes: 524_288,
        manifestHash: 'a'.repeat(64),
      },
      {
        kind: 'PRISMA_TABLE',
        name: 'EquipmentInspection',
        itemCount: 8,
        totalBytes: 32_768,
      },
    ],
    totalBytes: 524_288 + 32_768,
    totalItems: 150,
    ...over,
  });
}

describe('defaultBackupLabel', () => {
  it('renders yyyy-mm-dd-HHMM UTC', () => {
    const label = defaultBackupLabel(new Date('2026-05-23T15:07:00Z'));
    expect(label).toBe('2026-05-23-1507');
  });

  it('zero-pads single digits', () => {
    const label = defaultBackupLabel(new Date('2026-03-04T05:06:00Z'));
    expect(label).toBe('2026-03-04-0506');
  });
});

describe('newBackupId', () => {
  it('shape is bkp-<8 hex>', () => {
    const id = newBackupId();
    expect(id).toMatch(/^bkp-[0-9a-f]{8}$/);
  });
});

describe('summarizeBackups', () => {
  it('picks latest completed', () => {
    const a = manifest({ id: 'a', takenAt: '2026-05-20T00:00:00Z' });
    const b = manifest({ id: 'b', takenAt: '2026-05-22T00:00:00Z' });
    const r = summarizeBackups([a, b]);
    expect(r.latestCompleted?.id).toBe('b');
    expect(r.oldestCompleted?.id).toBe('a');
  });

  it('counts pending + failed separately', () => {
    const failed = manifest({ id: 'f', status: 'FAILED' });
    const pending = manifest({ id: 'p', status: 'IN_PROGRESS' });
    const ok = manifest({ id: 'o' });
    const r = summarizeBackups([failed, pending, ok]);
    expect(r.latestFailed?.id).toBe('f');
    expect(r.latestPending?.id).toBe('p');
    expect(r.latestCompleted?.id).toBe('o');
  });

  it('age comes back as a non-negative integer hour count', () => {
    const r = summarizeBackups([manifest()]);
    expect(r.ageOfLatestHours).not.toBeNull();
    expect(r.ageOfLatestHours).toBeGreaterThanOrEqual(0);
  });

  it('total of zero when list is empty', () => {
    const r = summarizeBackups([]);
    expect(r.total).toBe(0);
    expect(r.latestCompleted).toBeNull();
    expect(r.ageOfLatestHours).toBeNull();
  });
});

describe('isBackupStale', () => {
  it('false when within window', () => {
    const r = summarizeBackups([
      manifest({ takenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    ]);
    expect(isBackupStale(r, 24)).toBe(false);
  });

  it('true when older than the threshold', () => {
    const r = summarizeBackups([
      manifest({ takenAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }),
    ]);
    expect(isBackupStale(r, 24)).toBe(true);
  });

  it('true when no completed backups exist', () => {
    const r = summarizeBackups([manifest({ status: 'FAILED' })]);
    expect(isBackupStale(r, 24)).toBe(true);
  });
});

describe('compareManifests', () => {
  const prior = manifest({
    id: 'prior',
    components: [
      { kind: 'FILE_STORE', name: 'vendors', itemCount: 140, totalBytes: 500_000, manifestHash: 'a'.repeat(64) },
      { kind: 'FILE_STORE', name: 'rfis', itemCount: 10, totalBytes: 20_000 },
    ],
    totalBytes: 520_000,
    totalItems: 150,
  });

  it('flags CHANGED when items + hash differ', () => {
    const current = manifest({
      components: [
        { kind: 'FILE_STORE', name: 'vendors', itemCount: 142, totalBytes: 524_288, manifestHash: 'b'.repeat(64) },
        { kind: 'FILE_STORE', name: 'rfis', itemCount: 10, totalBytes: 20_000 },
      ],
    });
    const drift = compareManifests(prior, current);
    const v = drift.find((d) => d.name === 'vendors')!;
    expect(v.status).toBe('CHANGED');
    expect(v.hashChanged).toBe(true);
    expect(v.itemDelta).toBe(2);
    expect(v.bytesDelta).toBe(524_288 - 500_000);
  });

  it('flags ADDED when prior has no match', () => {
    const current = manifest({
      components: [
        { kind: 'FILE_STORE', name: 'vendors', itemCount: 140, totalBytes: 500_000, manifestHash: 'a'.repeat(64) },
        { kind: 'FILE_STORE', name: 'rfis', itemCount: 10, totalBytes: 20_000 },
        { kind: 'PRISMA_TABLE', name: 'PlanTakeoff', itemCount: 3, totalBytes: 8_000 },
      ],
    });
    const drift = compareManifests(prior, current);
    const added = drift.find((d) => d.name === 'PlanTakeoff')!;
    expect(added.status).toBe('ADDED');
  });

  it('flags REMOVED when current is missing prior component', () => {
    const current = manifest({
      components: [
        { kind: 'FILE_STORE', name: 'vendors', itemCount: 140, totalBytes: 500_000, manifestHash: 'a'.repeat(64) },
      ],
    });
    const drift = compareManifests(prior, current);
    const removed = drift.find((d) => d.name === 'rfis')!;
    expect(removed.status).toBe('REMOVED');
    expect(removed.itemDelta).toBeLessThan(0);
  });

  it('IDENTICAL when nothing changed', () => {
    const current = prior;
    const drift = compareManifests(prior, current);
    expect(drift.every((d) => d.status === 'IDENTICAL')).toBe(true);
  });

  it('treats prior=null as 100% ADDED', () => {
    const current = manifest();
    const drift = compareManifests(null, current);
    expect(drift.every((d) => d.status === 'ADDED')).toBe(true);
  });
});

describe('formatBytes', () => {
  it('B for tiny values', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
  it('KB threshold', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
  it('MB threshold', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('GB threshold', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});
