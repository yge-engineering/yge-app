// Employee-anchored per-job photo detail snapshot.
//
// Plain English: for one employee (matched on photographerName), return
// one row per job they photographed: photo total, category breakouts,
// last photo date. Sorted by total desc.
//
// Pure derivation. No persisted records.

import type { Photo } from './photo';

export interface EmployeePhotoDetailRow {
  jobId: string;
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

export interface EmployeePhotoDetailSnapshotResult {
  asOf: string;
  employeeName: string;
  rows: EmployeePhotoDetailRow[];
}

export interface EmployeePhotoDetailSnapshotInputs {
  employeeName: string;
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
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeePhotoDetailSnapshot(
  inputs: EmployeePhotoDetailSnapshotInputs,
): EmployeePhotoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.employeeName);

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
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
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
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.photos) {
    if (norm(p.photographerName) !== target) continue;
    if (p.takenOn > asOf) continue;
    const a = getAcc(p.jobId);
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

  const rows: EmployeePhotoDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
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
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeName: inputs.employeeName,
    rows,
  };
}
