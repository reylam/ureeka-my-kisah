import type { Account, AccountRole } from '@/types/account';
import { EMPTY_ONBOARDING } from '@/types/account';
import { hashPassword } from '@/lib/password';
import { PROVINCE } from './geography';

/**
 * Seed accounts.
 *
 * Four sign-ins so each role can be reviewed without an invitation flow. The
 * passwords are sample credentials for a build with no real data behind it.
 * They are never stored in plain text: `buildAccount` digests them at module
 * load, so nothing readable reaches localStorage.
 *
 * `SAMPLE_CREDENTIALS` below is the single source of truth for the credential
 * list that now lives in `docs/accounts.md`. It is no longer rendered on the
 * sign-in screen, which is why nothing imports it in the app; it stays so the
 * document and the seeds cannot drift apart.
 */

export interface SampleCredential {
  role: AccountRole | 'visitor';
  label: string;
  email: string;
  password: string;
  summary: string;
}

export const SAMPLE_CREDENTIALS: SampleCredential[] = [
  {
    role: 'visitor',
    label: 'Public / Visitor',
    email: 'No account needed',
    password: '',
    summary:
      'The home page, the TB explainer, the screening demo and the facility directory are open to everyone.',
  },
  {
    role: 'patient',
    label: 'Patient',
    email: 'patient@pulmo.test',
    password: 'Patient123!',
    summary: 'Own screening history, follow-up schedule, health profile and the learning centre.',
  },
  {
    role: 'professional',
    label: 'Healthcare professional',
    email: 'doctor@pulmo.test',
    password: 'Doctor123!',
    summary: 'Assigned patients, the review queue, referrals and follow-ups.',
  },
  {
    role: 'admin',
    label: 'Administrator',
    email: 'admin@pulmo.test',
    password: 'Admin123!',
    summary: 'Accounts, roles, the facility directory, record metadata and the audit log.',
  },
];

/** Deterministic salts, so a seeded account survives a page reload. */
function buildAccount(input: {
  id: string;
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  staffUserId?: string | null;
  patientId?: string | null;
  createdAt: string;
  onboarded?: boolean;
}): Account {
  const salt = `seed.${input.id}`;
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    passwordHash: hashPassword(input.password, salt),
    passwordSalt: salt,
    role: input.role,
    status: 'active',
    createdAt: input.createdAt,
    lastSignInAt: null,
    staffUserId: input.staffUserId ?? null,
    patientId: input.patientId ?? null,
    onboarding: input.onboarded
      ? {
          completedAt: input.createdAt,
          step: 3,
          personal: {
            fullName: input.name,
            birthDate: '1991-04-18',
            phone: '0812-5550-2043',
            sex: 'female',
          },
          address: {
            province: PROVINCE,
            district: 'Manggarai Barat',
            village: 'Labuan Bajo',
            addressLine: 'Jl. Soekarno Hatta No. 24',
          },
          health: {
            symptoms: ['cough', 'night-sweats'],
            symptomWeeks: 3,
            priorTb: 'never',
            householdContact: false,
            notes: '',
            shared: true,
          },
          consent: { acceptedAt: input.createdAt, dataUse: true, healthInfo: true },
        }
      : EMPTY_ONBOARDING,
  };
}

export const seedAccounts: Account[] = [
  buildAccount({
    id: 'acc_patient',
    name: 'Siti Rahmawati',
    email: 'patient@pulmo.test',
    password: 'Patient123!',
    role: 'patient',
    // Linked to a seeded clinical record so the dashboard has history to show.
    patientId: 'pat_001',
    createdAt: '2026-08-12T02:15:00.000Z',
    onboarded: true,
  }),
  buildAccount({
    id: 'acc_doctor',
    name: 'dr. Hanif Ramadhan',
    email: 'doctor@pulmo.test',
    password: 'Doctor123!',
    role: 'professional',
    staffUserId: 'usr_hanif',
    createdAt: '2026-06-02T01:00:00.000Z',
  }),
  buildAccount({
    id: 'acc_chw',
    name: 'Ayu Lestari',
    email: 'chw@pulmo.test',
    password: 'Worker123!',
    role: 'professional',
    staffUserId: 'usr_ayu',
    createdAt: '2026-06-02T01:05:00.000Z',
  }),
  buildAccount({
    id: 'acc_admin',
    name: 'Rina Hartati',
    email: 'admin@pulmo.test',
    password: 'Admin123!',
    role: 'admin',
    staffUserId: 'usr_rina',
    createdAt: '2026-05-20T00:30:00.000Z',
  }),
];
