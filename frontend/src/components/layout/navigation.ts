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
        label: 'Overview',
        icon: LayoutDashboard,
        primaryMobile: true,
        description: 'Your screening status and what is coming up',
      },
      {
        to: '/me/screenings',
        label: 'My Screenings',
        icon: ClipboardList,
        primaryMobile: true,
        description: 'Every screening on your record, with its report',
      },
      {
        to: '/me/followup',
        label: 'Follow-up',
        icon: CalendarClock,
        primaryMobile: true,
        description: 'Appointments and contact from your care team',
      },
    ],
  },
  {
    id: 'learn',
    label: 'Understand TB',
    items: [
      {
        to: '/me/learn',
        label: 'Health Learning',
        icon: GraduationCap,
        primaryMobile: true,
        description: 'Short guides about tuberculosis, written for patients',
      },
      {
        to: '/me/facilities',
        label: 'Healthcare Facilities',
        icon: Building2,
        description: 'Hospitals and puskesmas near you',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        to: '/me/profile',
        label: 'My Profile',
        icon: UserCircle,
        description: 'Your details, health answers and consent',
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
        description: 'Today’s screening workload and follow-up queue',
      },
      {
        to: '/patients',
        label: 'Patients',
        icon: Users,
        primaryMobile: true,
        description: 'Patient directory and screening histories',
      },
      {
        to: '/screenings/new',
        label: 'New Screening',
        icon: ScanLine,
        primaryMobile: true,
        description: 'Record a screening and upload a chest X-ray',
      },
    ],
  },
  {
    id: 'care',
    label: 'Care pathway',
    items: [
      {
        to: '/referrals',
        label: 'Referrals',
        icon: Send,
        badge: 'pendingReferrals',
        primaryMobile: true,
        description: 'Escalations to other facilities',
      },
      {
        to: '/followups',
        label: 'Follow-ups',
        icon: CalendarClock,
        badge: 'overdueFollowUps',
        primaryMobile: true,
        description: 'Scheduled contact and overdue tasks',
      },
      {
        to: '/facilities',
        label: 'Healthcare Facilities',
        icon: Building2,
        description: 'Directory of nearby facilities',
      },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      {
        to: '/reports',
        label: 'Reports',
        icon: FileText,
        description: 'Screening history and printable reports',
      },
      {
        to: '/offline',
        label: 'Offline Queue',
        icon: CloudOff,
        badge: 'pendingSync',
        description: 'Local drafts awaiting synchronisation',
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Profile, facility and storage',
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
        label: 'Overview',
        icon: LayoutDashboard,
        primaryMobile: true,
        description: 'Platform totals and recent activity',
      },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    items: [
      {
        to: '/admin/users',
        label: 'Accounts',
        icon: Users,
        primaryMobile: true,
        description: 'Users, roles and account status',
      },
      {
        to: '/admin/facilities',
        label: 'Facilities',
        icon: Building2,
        primaryMobile: true,
        description: 'Hospitals and puskesmas in the public directory',
      },
      {
        to: '/admin/screenings',
        label: 'Screening Records',
        icon: ClipboardList,
        primaryMobile: true,
        description: 'Record metadata and processing status',
      },
    ],
  },
  {
    id: 'oversight',
    label: 'Oversight',
    items: [
      {
        to: '/admin/audit',
        label: 'Audit Log',
        icon: ScrollText,
        description: 'Role changes, account and facility edits',
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Account and storage',
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
  patient: { to: '/me/learn', label: 'Start learning', icon: GraduationCap },
  professional: { to: '/screenings/new', label: 'New Screening', icon: ScanLine },
  admin: { to: '/admin/users', label: 'Manage accounts', icon: ShieldCheck },
};

/** Human-readable title for a pathname, used by the top bar breadcrumb. */
export const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/screenings': 'Screenings',
  '/screenings/new': 'New Screening',
  '/referrals': 'Referrals',
  '/followups': 'Follow-ups',
  '/facilities': 'Healthcare Facilities',
  '/reports': 'Reports',
  '/offline': 'Offline Queue',
  '/settings': 'Settings',
  '/me': 'Overview',
  '/me/screenings': 'My Screenings',
  '/me/followup': 'Follow-up',
  '/me/learn': 'Health Learning',
  '/me/facilities': 'Healthcare Facilities',
  '/me/profile': 'My Profile',
  '/admin': 'Administration',
  '/admin/users': 'Accounts',
  '/admin/facilities': 'Facilities',
  '/admin/screenings': 'Screening Records',
  '/admin/audit': 'Audit Log',
};

/** Icon used for the workspace badge in the sidebar header. */
export const ROLE_ICON: Record<AccountRole, ComponentType<{ className?: string }>> = {
  patient: UserCircle,
  professional: Stethoscope,
  admin: ShieldCheck,
};
