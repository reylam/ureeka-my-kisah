import {
  CalendarCheck,
  CalendarClock,
  FileEdit,
  MessageSquare,
  PhoneCall,
  ScanLine,
  Send,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { FollowUp, Patient, Referral, Screening } from '@/types/domain';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import {
  contactChannelLabel,
  contactOutcomeLabel,
  followUpReasonLabel,
  referralStatusLabel,
  screeningOutcomeShort,
} from '@/utils/labels';

/**
 * Builds the merged patient timeline.
 *
 * Kept in its own module rather than beside the component that renders it, so
 * the component file exports only components. That keeps React Fast Refresh
 * working during development.
 */

export type TimelineTone = 'neutral' | 'ct' | 'attention' | 'urgent' | 'complete';

export interface TimelineEntry {
  id: string;
  at: string;
  icon: ComponentType<{ className?: string }>;
  tone: TimelineTone;
  title: ReactNode;
  body?: ReactNode;
  actor?: string;
  to?: string;
}

function actorName(id: string): string {
  return users.find((user) => user.id === id)?.name ?? 'Unknown user';
}

/**
 * Merges every dated event touching this patient (registration, screenings,
 * reviews, referral status changes, contact attempts and notes) into a single
 * chronological story. Reading five separate tabs to work out what happened to
 * someone is how details get missed.
 */
export function buildTimeline(
  patient: Patient,
  screenings: Screening[],
  referrals: Referral[],
  followUps: FollowUp[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({
    id: `reg-${patient.id}`,
    at: patient.registeredAt,
    icon: UserPlus,
    tone: 'neutral',
    title: 'Registered at this facility',
    body: `${patient.village}, ${patient.district}`,
  });

  screenings.forEach((screening) => {
    entries.push({
      id: `scr-${screening.id}`,
      at: screening.performedAt,
      icon: screening.status === 'draft' ? FileEdit : ScanLine,
      tone: screening.analysis?.outcome === 'flagged-for-review' ? 'attention' : 'ct',
      title:
        screening.status === 'draft'
          ? 'Screening started but not completed'
          : 'Chest X-ray screening recorded',
      body: screening.analysis ? (
        <>
          Demo output: {screeningOutcomeShort[screening.analysis.outcome]}
          {screening.analysis.regions.length > 0
            ? ` · ${screening.analysis.regions.length} region${screening.analysis.regions.length === 1 ? '' : 's'} marked`
            : ''}
        </>
      ) : (
        'No analysis output yet'
      ),
      actor: actorName(screening.operatorId),
      to: screening.status === 'draft' ? undefined : `/screenings/${screening.id}`,
    });

    if (screening.review) {
      entries.push({
        id: `rev-${screening.id}`,
        at: screening.review.reviewedAt,
        icon: ShieldCheck,
        tone: 'complete',
        title: 'Screening reviewed',
        body: screening.review.notes,
        actor: actorName(screening.review.reviewerId),
        to: `/screenings/${screening.id}`,
      });
    }
  });

  referrals.forEach((referral) => {
    const destination = facilities.find((f) => f.id === referral.toFacilityId);
    referral.history.forEach((event) => {
      entries.push({
        id: `refev-${event.id}`,
        at: event.at,
        icon:
          event.to === 'attended'
            ? CalendarCheck
            : event.to === 'appointment-scheduled'
              ? CalendarClock
              : Send,
        tone:
          event.to === 'attended' || event.to === 'closed'
            ? 'complete'
            : event.to === 'followup-required'
              ? 'attention'
              : 'ct',
        title: (
          <>
            Referral {referral.code} ·{' '}
            <span className="font-normal text-obsidian-600">
              {referralStatusLabel[event.to].toLowerCase()}
            </span>
          </>
        ),
        body: event.note ?? `Destination: ${destination?.name ?? 'unknown facility'}`,
        actor: actorName(event.actorId),
        to: `/referrals?focus=${referral.id}`,
      });
    });
  });

  followUps.forEach((followUp) => {
    followUp.attempts.forEach((attempt) => {
      entries.push({
        id: `att-${attempt.id}`,
        at: attempt.at,
        icon: PhoneCall,
        tone: attempt.outcome === 'reached' ? 'complete' : 'attention',
        title: (
          <>
            Contact attempt ·{' '}
            <span className="font-normal text-obsidian-600">
              {contactChannelLabel[attempt.channel].toLowerCase()},{' '}
              {(contactOutcomeLabel[attempt.outcome] ?? attempt.outcome).toLowerCase()}
            </span>
          </>
        ),
        body: attempt.note ?? undefined,
        actor: actorName(attempt.actorId),
        to: `/followups?focus=${followUp.id}`,
      });
    });

    if (followUp.completedAt) {
      entries.push({
        id: `fupdone-${followUp.id}`,
        at: followUp.completedAt,
        icon: CalendarCheck,
        tone: 'complete',
        title: `Follow-up completed · ${followUpReasonLabel[followUp.reason].toLowerCase()}`,
        to: `/followups?focus=${followUp.id}`,
      });
    }
  });

  // Notes already surfaced as review entries are skipped to avoid duplicates.
  const reviewNoteBodies = new Set(
    screenings.filter((s) => s.review).map((s) => s.review!.notes),
  );
  patient.notes
    .filter((note) => !(note.context === 'screening' && reviewNoteBodies.has(note.body)))
    .forEach((note) => {
      entries.push({
        id: `note-${note.id}`,
        at: note.createdAt,
        icon: MessageSquare,
        tone: 'neutral',
        title: 'Note added',
        body: note.body,
        actor: actorName(note.authorId),
      });
    });

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}
