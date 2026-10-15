import {
  Building2,
  CalendarClock,
  CloudOff,
  FileText,
  LayoutDashboard,
  ScanLine,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Navigation model.
 *
 * `badge` names a counter the sidebar resolves from the data store, so the
 * navigation tells you where the work is before you click anything. Only
 * genuinely actionable counts get a badge. Decorative numbers are noise.
 */
export type BadgeKey = 'awaitingReview' | 'pendingReferrals' | 'overdueFollowUps' | 'pendingSync';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown in the mobile bottom bar (the rest live in "More"). */
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

export const navSections: NavSection[] = [
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
        description: 'Sample directory of nearby facilities',
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
        description: 'Local drafts and demo synchronisation',
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Profile, facility and demo data controls',
      },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);

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
};
