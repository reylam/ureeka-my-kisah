import type { User } from '@/types/domain';
import { OPERATING_FACILITY_ID } from './facilities';

/**
 * Demo staff accounts. Fictional people.
 *
 * Authentication in this prototype is simulated entirely in the browser, see
 * `stores/authStore.ts`. No credential here is checked against any server, and
 * the password below is a demo convenience, not a secret.
 */

export const DEMO_PASSWORD = 'demo1234';

export const users: User[] = [
  {
    id: 'usr_ayu',
    name: 'Ayu Lestari',
    role: 'chw',
    canReview: false,
    facilityId: OPERATING_FACILITY_ID,
    email: 'ayu.lestari@demo.sentratb.id',
    phone: '0812-5550-7781',
  },
  {
    id: 'usr_hanif',
    name: 'dr. Hanif Ramadhan',
    role: 'physician',
    canReview: true,
    facilityId: OPERATING_FACILITY_ID,
    email: 'hanif.ramadhan@demo.sentratb.id',
    phone: '0812-5550-3302',
  },
  {
    id: 'usr_yohana',
    name: 'Ns. Yohana Bete',
    role: 'nurse',
    canReview: true,
    facilityId: 'fac_puskesmas_satar_mese',
    email: 'yohana.bete@demo.sentratb.id',
    phone: '0813-5550-9915',
  },
  {
    id: 'usr_marsel',
    name: 'Marselinus Dopo',
    role: 'chw',
    canReview: false,
    facilityId: 'fac_puskesmas_nanga_baru',
    email: 'marselinus.dopo@demo.sentratb.id',
    phone: '0821-5550-4428',
  },
  {
    id: 'usr_rina',
    name: 'Rina Hartati',
    role: 'coordinator',
    canReview: false,
    facilityId: OPERATING_FACILITY_ID,
    email: 'rina.hartati@demo.sentratb.id',
    phone: '0812-5550-1163',
  },
  {
    id: 'usr_clara',
    name: 'Ns. Clara Ndiwa',
    role: 'nurse',
    canReview: true,
    facilityId: 'fac_puskesmas_warloka',
    email: 'clara.ndiwa@demo.sentratb.id',
    phone: '0819-5550-6604',
  },
];

/** The account pre-filled on the login screen. */
export const DEMO_USER_ID = 'usr_ayu';

export const usersById = new Map(users.map((u) => [u.id, u]));

/** Field workers who can be assigned referrals and follow-ups. */
export const assignableWorkerIds = users
  .filter((u) => u.role === 'chw' || u.role === 'nurse')
  .map((u) => u.id);
