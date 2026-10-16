import {
  Building2,
  CalendarClock,
  ClipboardList,
  CloudOff,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ScanLine,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCircle,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { AccountRole } from '@/types/account';

/**
 * Navigation model, one tree per role.
 *
 * The three workspaces share a shell but not a menu: a patient has no business
 * seeing a link to the referral register, and an administrator has no business
 * seeing one to the review queue. Returning a different tree per role is also
 * what keeps the sidebar honest, because a link that is present but blocked by
 * a guard is a worse experience than no link.
 *
 * `badge` names a counter the sidebar resolves from the data store, so the
 * navigation says where the work is before anything is clicked. Only genuinely
 * actionable counts get one; decorative numbers are noise.
 */
export type BadgeKey = 'awaitingReview' | 'pendingReferrals' | 'overdueFollowUps' | 'pendingSync';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown in the mobile bottom bar; the rest live in "More". */
  primaryMobile?: boolean;
  badge?: BadgeKey;
  /** Short description used by the mobile "More" sheet. */
  description: string;
}

export interface NavSection {
  id: string;
  label: string | null;
  items: NavItem[];
}

/* ── Patient ──────────────────────────────────────────────────────────────── */

const patientNav: NavSection[] = [
  {
    id: 'care',
    label: null,
    items: [
      {
        to: '/me',
        label: 'Ringkasan',
        icon: LayoutDashboard,
        primaryMobile: true,
        description: 'Status screening kamu dan jadwal yang akan datang',
      },
      {
        to: '/me/screenings',
        label: 'Screening Saya',
        icon: ClipboardList,
        primaryMobile: true,
        description: 'Semua screening di rekam medismu, lengkap dengan report-nya',
      },
      {
        to: '/me/followup',
        label: 'Follow-up',
        icon: CalendarClock,
        primaryMobile: true,
        description: 'Janji temu dan kontak dari tim perawatanmu',
      },
    ],
  },
  {
    id: 'learn',
    label: 'Kenali TB',
    items: [
      {
        to: '/me/learn',
        label: 'Edukasi Kesehatan',
        icon: GraduationCap,
        primaryMobile: true,
        description: 'Panduan singkat tentang tuberkulosis untuk pasien',
      },
      {
        to: '/me/facilities',
        label: 'Fasilitas Kesehatan',
        icon: Building2,
        description: 'Rumah sakit dan puskesmas di dekatmu',
      },
    ],
  },
  {
    id: 'account',
    label: 'Akun',
    items: [
      {
        to: '/me/profile',
        label: 'Profil Saya',
        icon: UserCircle,
        description: 'Data diri, jawaban kesehatan, dan persetujuanmu',
      },
    ],
  },
];

/* ── Healthcare professional ──────────────────────────────────────────────── */

const professionalNav: NavSection[] = [
  {
    id: 'work',
    label: null,
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        primaryMobile: true,
        description: 'Beban kerja screening hari ini dan antrean follow-up',
      },
      {
        to: '/patients',
        label: 'Pasien',
        icon: Users,
        primaryMobile: true,
        description: 'Direktori pasien dan riwayat screening',
      },
      {
        to: '/screenings/new',
        label: 'Screening Baru',
        icon: ScanLine,
        primaryMobile: true,
        description: 'Catat screening dan upload X-ray dada',
      },
    ],
  },
  {
    id: 'care',
    label: 'Alur perawatan',
    items: [
      {
        to: '/referrals',
        label: 'Referral',
        icon: Send,
        badge: 'pendingReferrals',
        primaryMobile: true,
        description: 'Eskalasi ke fasilitas lain',
      },
      {
        to: '/followups',
        label: 'Follow-up',
        icon: CalendarClock,
        badge: 'overdueFollowUps',
        primaryMobile: true,
        description: 'Kontak terjadwal dan tugas yang terlambat',
      },
      {
        to: '/facilities',
        label: 'Fasilitas Kesehatan',
        icon: Building2,
        description: 'Direktori fasilitas terdekat',
      },
    ],
  },
  {
    id: 'records',
    label: 'Record',
    items: [
      {
        to: '/reports',
        label: 'Report',
        icon: FileText,
        description: 'Riwayat screening dan report yang bisa dicetak',
      },
      {
        to: '/offline',
        label: 'Offline Queue',
        icon: CloudOff,
        badge: 'pendingSync',
        description: 'Draf lokal yang menunggu sync',
      },
      {
        to: '/settings',
        label: 'Pengaturan',
        icon: Settings,
        description: 'Profil, fasilitas, dan storage',
      },
    ],
  },
];

/* ── Administrator ────────────────────────────────────────────────────────── */

const adminNav: NavSection[] = [
  {
    id: 'overview',
    label: null,
    items: [
      {
        to: '/admin',
        label: 'Ringkasan',
        icon: LayoutDashboard,
        primaryMobile: true,
        description: 'Total platform dan aktivitas terbaru',
      },
    ],
  },
  {
    id: 'manage',
    label: 'Kelola',
    items: [
      {
        to: '/admin/users',
        label: 'Akun',
        icon: Users,
        primaryMobile: true,
        description: 'Pengguna, peran, dan status akun',
      },
      {
        to: '/admin/facilities',
        label: 'Fasilitas',
        icon: Building2,
        primaryMobile: true,
        description: 'Rumah sakit dan puskesmas di direktori publik',
      },
      {
        to: '/admin/screenings',
        label: 'Record Screening',
        icon: ClipboardList,
        primaryMobile: true,
        description: 'Metadata record dan status pemrosesan',
      },
    ],
  },
  {
    id: 'oversight',
    label: 'Pengawasan',
    items: [
      {
        to: '/admin/audit',
        label: 'Audit Log',
        icon: ScrollText,
        description: 'Perubahan peran serta perubahan akun dan fasilitas',
      },
      {
        to: '/settings',
        label: 'Pengaturan',
        icon: Settings,
        description: 'Akun dan storage',
      },
    ],
  },
];

const NAV_BY_ROLE: Record<AccountRole, NavSection[]> = {
  patient: patientNav,
  professional: professionalNav,
  admin: adminNav,
};

export function navSectionsFor(role: AccountRole | null): NavSection[] {
  return role ? NAV_BY_ROLE[role] : [];
}

export function navItemsFor(role: AccountRole | null): NavItem[] {
  return navSectionsFor(role).flatMap((section) => section.items);
}

/** The primary action in each workspace, shown at the foot of the sidebar. */
export const PRIMARY_ACTION: Record<
  AccountRole,
  { to: string; label: string; icon: ComponentType<{ className?: string }> } | null
> = {
  patient: { to: '/me/learn', label: 'Mulai belajar', icon: GraduationCap },
  professional: { to: '/screenings/new', label: 'Screening Baru', icon: ScanLine },
  admin: { to: '/admin/users', label: 'Kelola akun', icon: ShieldCheck },
};

/** Human-readable title for a pathname, used by the top bar breadcrumb. */
export const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/patients': 'Pasien',
  '/screenings': 'Screening',
  '/screenings/new': 'Screening Baru',
  '/referrals': 'Referral',
  '/followups': 'Follow-up',
  '/facilities': 'Fasilitas Kesehatan',
  '/reports': 'Report',
  '/offline': 'Offline Queue',
  '/settings': 'Pengaturan',
  '/me': 'Ringkasan',
  '/me/screenings': 'Screening Saya',
  '/me/followup': 'Follow-up',
  '/me/learn': 'Edukasi Kesehatan',
  '/me/facilities': 'Fasilitas Kesehatan',
  '/me/profile': 'Profil Saya',
  '/admin': 'Administrasi',
  '/admin/users': 'Akun',
  '/admin/facilities': 'Fasilitas',
  '/admin/screenings': 'Record Screening',
  '/admin/audit': 'Audit Log',
};

/** Icon used for the workspace badge in the sidebar header. */
export const ROLE_ICON: Record<AccountRole, ComponentType<{ className?: string }>> = {
  patient: UserCircle,
  professional: Stethoscope,
  admin: ShieldCheck,
};
