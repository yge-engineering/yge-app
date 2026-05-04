// User credentials store — scrypt-hashed passwords for seeded users.
//
// Plain English: the password gate for app.youngge.com. The web app
// keeps the seeded-user allowlist (Ryan + Brook). The first time
// someone signs in, they pick a password; subsequent sign-ins compare
// the typed password against the stored scrypt hash.
//
// Storage: data/credentials.json on the API's data dir. Same pattern
// as the other JSON-backed stores (dir-rates, jobs, etc).

import { promises as fs } from 'fs';
import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import path from 'path';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

function dataDir(): string {
  return process.env.CREDENTIALS_DATA_DIR ?? path.resolve(process.cwd(), 'data');
}

function filePath(): string {
  return path.join(dataDir(), 'credentials.json');
}

interface StoredCredential {
  /** Lowercase email (key). */
  email: string;
  /** Hex-encoded salt. */
  salt: string;
  /** Hex-encoded scrypt hash. */
  hash: string;
  /** ISO date when the password was set. */
  setAt: string;
}

interface FileShape {
  credentials: StoredCredential[];
}

async function readAll(): Promise<FileShape> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8');
    return JSON.parse(raw) as FileShape;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { credentials: [] };
    }
    throw err;
  }
}

async function writeAll(data: FileShape): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(data, null, 2));
}

async function findCredential(email: string): Promise<StoredCredential | null> {
  const file = await readAll();
  const norm = email.toLowerCase();
  return file.credentials.find((c) => c.email === norm) ?? null;
}

/** True iff a password has been set for this email. */
export async function hasPassword(email: string): Promise<boolean> {
  const cred = await findCredential(email);
  return cred !== null;
}

/** Set or replace the password for this email. Throws on too-short input. */
export async function setPassword(
  email: string,
  password: string,
): Promise<void> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const file = await readAll();
  const norm = email.toLowerCase();
  const salt = randomBytes(16).toString('hex');
  const hashBuf = await scrypt(password, salt, KEY_LEN);
  const newCred: StoredCredential = {
    email: norm,
    salt,
    hash: hashBuf.toString('hex'),
    setAt: new Date().toISOString(),
  };
  const idx = file.credentials.findIndex((c) => c.email === norm);
  if (idx >= 0) file.credentials[idx] = newCred;
  else file.credentials.push(newCred);
  await writeAll(file);
}

/** Verify that the password matches the stored hash for this email. */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const cred = await findCredential(email);
  if (!cred) return false;
  const candidate = await scrypt(password, cred.salt, KEY_LEN);
  const expected = Buffer.from(cred.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
