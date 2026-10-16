/**
 * Password rules shown while someone types.
 *
 * This is feedback only. Passwords are checked, hashed and stored by Supabase
 * Auth; the browser never keeps one and never computes a digest of one.
 */

export interface PasswordStrength {
  ok: boolean;
  /** Plain-language list of what is still missing. */
  problems: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const problems: string[] = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[a-z]/.test(password)) problems.push('a lower-case letter');
  if (!/[A-Z]/.test(password)) problems.push('an upper-case letter');
  if (!/\d/.test(password)) problems.push('a number');
  return { ok: problems.length === 0, problems };
}
