import { hashPassword, verifyPassword } from './password.util';

describe('password hashing', () => {
  it('verifies a password against its own hash', async () => {
    const stored = await hashPassword('NightOwl!2026');

    await expect(verifyPassword('NightOwl!2026', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('NightOwl!2026');

    await expect(verifyPassword('nightowl!2027', stored)).resolves.toBe(false);
  });

  it('stores the algorithm, salt and hash so parameters can change later', async () => {
    const stored = await hashPassword('NightOwl!2026');
    const [algorithm, salt, hash] = stored.split('$');

    expect(algorithm).toBe('scrypt');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it('salts every hash, so equal passwords store differently', async () => {
    const first = await hashPassword('NightOwl!2026');
    const second = await hashPassword('NightOwl!2026');

    expect(first).not.toBe(second);
    await expect(verifyPassword('NightOwl!2026', second)).resolves.toBe(true);
  });

  it('returns false for a malformed stored value instead of throwing', async () => {
    await expect(verifyPassword('NightOwl!2026', '')).resolves.toBe(false);
    await expect(verifyPassword('NightOwl!2026', 'bcrypt$aa$bb')).resolves.toBe(false);
    await expect(verifyPassword('NightOwl!2026', 'scrypt$onlysalt')).resolves.toBe(false);
  });

  it('returns false when the stored hash has an impossible length', async () => {
    await expect(verifyPassword('NightOwl!2026', 'scrypt$aa$bb')).resolves.toBe(false);
  });
});
