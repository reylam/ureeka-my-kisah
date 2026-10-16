/**
 * Staff accounts. Patients have no account: they use the access code their
 * request returned.
 */
export type AccountRole = 'admin' | 'radiologist';

export interface Account {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
}
