// Job-anchored per-photographer photo detail snapshot.
//
// Plain English: for one job, return one row per photographer who
// took photos on it: photo total, category breakouts (progress,
// delay, change-order, SWPPP, incident, punch, completion,
// pre-construction, other), last photo date. Sorted by total desc.
//
// Pure derivation. No persisted records.

import type { Photo } from './photo';

export interface JobPhotoDetailRow {
  photographerName: string;
  total: number;
  progress: number;
  delay: number;
  changeOrder: number;
  swppp: number;
  incident: number;
  punch: number;
  completion: number;
  preConstruction: number;
  other: number;
  lastPhotoDate: string | null;
}

export interface JobPhotoDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobPhotoDetailRow[];
}

export interface JobPhotoDetailSnapshotInputs {
  jobId: string;
  photos: Photo[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

export function buildJobPhotoDetailSnapshot(
  inputs: JobPhotoDetailSnapshotInputs,
): JobPhotoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    progress: number;
    delay: number;
    changeOrder: number;
    swppp: number;
    incident: number;
    punch: number;
    completion: number;
    preConstruction: number;
    other: number;
    lastDate: string | null;
  };
  const byPerson = new Map<string, Acc>();
  function getAcc(name: string): Acc {
    let a = byPerson.get(name);
    if (!a) {
      a = {
        total: 0,
        progress: 0,
        delay: 0,
        changeOrder: 0,
        swppp: 0,
        incident: 0,
        punch: 0,
        completion: 0,
        preConstruction: 0,
        other: 0,
        lastDate: null,
      };
      byPerson.set(name, a);
    }
    return a;
  }

  for (const p of inputs.photos) {
    if (p.jobId !== inputs.jobId) continue;
    if (p.takenOn > asOf) continue;
    const name = norm(p.photographerName) || '(unknown)';
    const a = getAcc(name);
    a.total += 1;
    switch (p.category) {
      case 'PROGRESS': a.progress += 1; break;
      case 'DELAY': a.delay += 1; break;
      case 'CHANGE_ORDER': a.changeOrder += 1; break;
      case 'SWPPP': a.swppp += 1; break;
      case 'INCIDENT': a.incident += 1; break;
      case 'PUNCH': a.punch += 1; break;
      case 'COMPLETION': a.completion += 1; break;
      case 'PRE_CONSTRUCTION': a.preConstruction += 1; break;
      default: a.other += 1;
    }
    if (a.lastDate == null || p.takenOn > a.lastDate) a.lastDate = p.takenOn;
  }

  const rows: JobPhotoDetailRow[] = [...byPerson.entries()]
    .map(([photographerName, a]) => ({
      photographerName,
      total: a.total,
      progress: a.progress,
      delay: a.delay,
      changeOrder: a.changeOrder,
      swppp: a.swppp,
      incident: a.incident,
      punch: a.punch,
      completion: a.completion,
      preConstruction: a.preConstruction,
      other: a.other,
      lastPhotoDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.photographerName.localeCompare(b.photographerName));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
