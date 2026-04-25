import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createJob, getJob, listJobs, updateJob } from './jobs-store';

let tmpDir: string;
const ORIGINAL_ENV = process.env.JOBS_DATA_DIR;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yge-jobs-'));
  process.env.JOBS_DATA_DIR = tmpDir;
});

afterEach(async () => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.JOBS_DATA_DIR;
  } else {
    process.env.JOBS_DATA_DIR = ORIGINAL_ENV;
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('createJob', () => {
  it('creates a job with a stable id and PURSUING default status', async () => {
    const job = await createJob({
      projectName: 'Sulphur Springs Soquol Road',
      projectType: 'DRAINAGE',
      contractType: 'PUBLIC_WORKS',
    });
    expect(job.id).toMatch(/^job-\d{4}-\d{2}-\d{2}-sulphur-springs-soquol-road-[a-f0-9]{8}$/);
    expect(job.status).toBe('PURSUING');
  });

  it('honors caller-provided status', async () => {
    const job = await createJob({
      projectName: 'Old archived',
      projectType: 'OTHER',
      contractType: 'OTHER',
      status: 'ARCHIVED',
    });
    expect(job.status).toBe('ARCHIVED');
  });

  it('writes a file we can re-read by id', async () => {
    const job = await createJob({
      projectName: 'Reread test',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    const fetched = await getJob(job.id);
    expect(fetched?.id).toBe(job.id);
    expect(fetched?.projectName).toBe('Reread test');
  });

  it('appends to the index newest-first', async () => {
    await createJob({
      projectName: 'First',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    await new Promise((r) => setTimeout(r, 5));
    await createJob({
      projectName: 'Second',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    const list = await listJobs();
    expect(list).toHaveLength(2);
    expect(list[0].projectName).toBe('Second');
    expect(list[1].projectName).toBe('First');
  });
});

describe('getJob', () => {
  it('returns null on unknown id', async () => {
    expect(await getJob('job-2026-01-01-nope-deadbeef')).toBeNull();
  });

  it('rejects path-traversal attempts', async () => {
    expect(await getJob('../etc/passwd')).toBeNull();
    expect(await getJob('job-../foo')).toBeNull();
  });
});

describe('updateJob', () => {
  it('patches fields and bumps updatedAt', async () => {
    const job = await createJob({
      projectName: 'Patch me',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateJob(job.id, {
      ownerAgency: 'City of Cottonwood',
      status: 'BID_SUBMITTED',
    });
    expect(updated?.ownerAgency).toBe('City of Cottonwood');
    expect(updated?.status).toBe('BID_SUBMITTED');
    expect(updated?.updatedAt).not.toBe(job.updatedAt);
  });

  it('keeps id and createdAt stable through patches', async () => {
    const job = await createJob({
      projectName: 'Stable',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    const updated = await updateJob(job.id, { notes: 'something' });
    expect(updated?.id).toBe(job.id);
    expect(updated?.createdAt).toBe(job.createdAt);
  });

  it('returns null on unknown id', async () => {
    expect(
      await updateJob('job-2026-01-01-nope-deadbeef', { notes: 'x' }),
    ).toBeNull();
  });

  it('updates the index entry after a patch', async () => {
    const job = await createJob({
      projectName: 'Indexed',
      projectType: 'OTHER',
      contractType: 'PUBLIC_WORKS',
    });
    await updateJob(job.id, { ownerAgency: 'Caltrans' });
    const list = await listJobs();
    expect(list[0].ownerAgency).toBe('Caltrans');
  });
});
