// Postgres-backed store for scrypt-hashed passwords.
// Same external API as the file-store version: hasPassword,
// setPassword, clearPassword, verifyPassword.

import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@yge/db';
import { getRequestCompanyId } from './request-context';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;
const FALLBACK_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'yge-root';
function companyId(): string {
  return getRequestCompanyId() ?? FALLBACK_COMPANY_ID;
}

interface StoredCredential {
  email: string;
  salt: string;
  hash: string;
  setAt: string;
}

function row2cred(row: { data: unknown }): StoredCredential {
  return row.data as unknown as StoredCredential;
}

async function findCredential(email: string): Promise<StoredCredential | null> {
  const norm = email.toLowerCase();
  const row = await prisma.credential.findUnique({
    where: { companyId_email: { companyId: companyId(), email: norm } },
  });
  return row ? row2cred(row) : null;
}

export async function hasPassword(email: string): Promise<boolean> {
  return (await findCredential(email)) !== null;
}

export async function setPassword(email: string, password: string): Promise<void> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const norm = email.toLowerCase();
  const salt = randomBytes(16).toString('hex');
  const hashBuf = await scrypt(password, salt, KEY_LEN);
  const cred: StoredCredential = {
    email: norm,
    salt,
    hash: hashBuf.toString('hex'),
    setAt: new Date().toISOString(),
  };
  await prisma.credential.upsert({
    where: { companyId_email: { companyId: companyId(), email: norm } },
    create: {
      id: `cred-${norm.replace(/[^a-z0-9]/g, '').slice(0, 24)}`,
      companyId: companyId(),
      email: norm,
      data: cred as unknown as object,
    },
    update: { data: cred as unknown as object },
  });
}

export async function clearPassword(email: string): Promise<boolean> {
  const norm = email.toLowerCase();
  const existing = await findCredential(norm);
  if (!existing) return false;
  await prisma.credential.delete({
    where: { companyId_email: { companyId: companyId(), email: norm } },
  });
  return true;
}

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
