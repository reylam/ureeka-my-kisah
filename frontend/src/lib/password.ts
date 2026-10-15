/**
 * Local password digest.
 *
 * This is NOT password hashing in the security sense and nothing here should
 * be mistaken for it. It is a deterministic digest whose only job is to keep
 * plain-text passwords out of localStorage and out of store snapshots in a
 * frontend-only build.
 *
 * Why not WebCrypto SHA-256? It is async, which would force every seed account
 * and every sign-in path through a promise for no gain: an attacker with the
 * browser already has the code, the salt and the comparison. The weakness here
 * is the architecture, not the digest.
 *
 * When the API arrives, delete this file. Verification moves to the server
 * with bcrypt or argon2, and the client stops seeing passwords at all.
 */

const ROUNDS = 1_000;

/** FNV-1a, iterated, with the salt folded in on every round. */
function digest(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashPassword(password: string, salt: string): string {
  let value = `${salt}:${password}`;
  for (let round = 0; round < ROUNDS; round += 1) {
    value = digest(`${value}:${salt}:${round}`) + digest(`${round}:${value}`);
  }
  return value;
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  return hashPassword(password, salt) === hash;
}

export function createSalt(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* ── Strength rules, shared by registration and password change ──────────── */

export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

export function checkPasswordStrength(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[a-z]/.test(password)) problems.push('a lower-case letter');
  if (!/[A-Z]/.test(password)) problems.push('an upper-case letter');
  if (!/[0-9]/.test(password)) problems.push('a number');
  return { ok: problems.length === 0, problems };
}
