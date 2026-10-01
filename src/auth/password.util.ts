import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Password hashing for staff accounts, using scrypt from the Node standard
 * library. Stored form is `scrypt$<salt-hex>$<hash-hex>` so the algorithm and
 * parameters can be changed later without invalidating existing rows.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split('$');

  if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);

  // Lengths already match by construction; guard anyway so timingSafeEqual
  // cannot throw on a malformed stored value.
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}
