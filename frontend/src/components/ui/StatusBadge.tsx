import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  CircleSlash,
  CloudOff,
  CloudUpload,
  Clock,
  FileEdit,
  GitCompareArrows,
  Hourglass,
  Minus,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import type {
  FollowUpBucket,
  FollowUpStatus,
  ImageQuality,
  ReferralPriority,
  ReferralStatus,
  ScreeningOutcome,
  ScreeningStatus,
  SyncState,
} from '@/types/domain';
import { Badge, type BadgeTone } from './Badge';
import {
  facilityInfoStatusLabel,
  followUpStatusLabel,
  imageQualityLabel,
  referralPriorityLabel,
  referralStatusLabel,
  screeningOutcomeLabel,
  screeningOutcomeShort,
  screeningStatusLabel,
  syncStateLabel,
} from '@/utils/labels';

/**
 * Centralised status rendering.
 *
 * Mapping every status to its tone and icon in one place is what keeps the
 * product visually consistent: a "Referred" badge looks the same on the
 * dashboard, in the patient record and in the printed report.
 *
 * Colour conventions:
 *   neutral/inert  → informational or inactive workflow states
 *   attention      → something is waiting on a person
 *   urgent         → operationally overdue or failed
 *   complete       → workflow finished
 *   info (CT blue) → never used for clinical meaning, only for neutral facts
 */

/* ── Screening workflow ────────────────────────────────────────────────────── */

const screeningStatusTone: Record<ScreeningStatus, BadgeTone> = {
  draft: 'inert',
  queued: 'neutral',
  'awaiting-review': 'attention',
  reviewed: 'complete',
  referred: 'info',
  closed: 'neutral',
};

const screeningStatusIcon: Record<ScreeningStatus, React.ReactNode> = {
  draft: <FileEdit />,
  queued: <Hourglass />,
  'awaiting-review': <Clock />,
  reviewed: <ShieldCheck />,
  referred: <ArrowUpRight />,
  closed: <CircleDashed />,
};

export function ScreeningStatusBadge({
  status,
  size,
}: {
  status: ScreeningStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={screeningStatusTone[status]} icon={screeningStatusIcon[status]} size={size}>
      {screeningStatusLabel[status]}
    </Badge>
  );
}

/* ── Screening outcome ─────────────────────────────────────────────────────── */

/**
 * Outcome tones deliberately avoid green for "no alert": an absent alert is
 * not a clean bill of health, and colouring it green would imply otherwise.
 */
const outcomeTone: Record<ScreeningOutcome, BadgeTone> = {
  'flagged-for-review': 'attention',
  'no-alert': 'neutral',
  inconclusive: 'inert',
};

const outcomeIcon: Record<ScreeningOutcome, React.ReactNode> = {
  'flagged-for-review': <Stethoscope />,
  'no-alert': <Minus />,
  inconclusive: <CircleHelp />,
};

export function ScreeningOutcomeBadge({
  outcome,
  short = false,
  size,
}: {
  outcome: ScreeningOutcome;
  short?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge
      tone={outcomeTone[outcome]}
      icon={outcomeIcon[outcome]}
      size={size}
      title={screeningOutcomeLabel[outcome]}
    >
      {short ? screeningOutcomeShort[outcome] : screeningOutcomeLabel[outcome]}
    </Badge>
  );
}

/* ── Image quality ─────────────────────────────────────────────────────────── */

const qualityTone: Record<ImageQuality, BadgeTone> = {
  adequate: 'neutral',
  borderline: 'attention',
  inadequate: 'urgent',
};

export function ImageQualityBadge({ quality, size }: { quality: ImageQuality; size?: 'sm' | 'md' }) {
  return (
    <Badge
      tone={qualityTone[quality]}
      size={size}
      icon={quality === 'adequate' ? <CheckCircle2 /> : <AlertTriangle />}
    >
      Gambar {imageQualityLabel[quality].toLowerCase()}
    </Badge>
  );
}

/* ── Referrals ─────────────────────────────────────────────────────────────── */

const referralTone: Record<ReferralStatus, BadgeTone> = {
  draft: 'inert',
  pending: 'attention',
  referred: 'info',
  'appointment-scheduled': 'info',
  attended: 'complete',
  'followup-required': 'attention',
  closed: 'neutral',
};

const referralIcon: Record<ReferralStatus, React.ReactNode> = {
  draft: <FileEdit />,
  pending: <Clock />,
  referred: <ArrowUpRight />,
  'appointment-scheduled': <CalendarClock />,
  attended: <CalendarCheck />,
  'followup-required': <PhoneCall />,
  closed: <CircleDashed />,
};

export function ReferralStatusBadge({
  status,
  size,
}: {
  status: ReferralStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={referralTone[status]} icon={referralIcon[status]} size={size}>
      {referralStatusLabel[status]}
    </Badge>
  );
}

const priorityTone: Record<ReferralPriority, BadgeTone> = {
  routine: 'neutral',
  soon: 'attention',
  urgent: 'urgent',
};

export function ReferralPriorityBadge({
  priority,
  size,
}: {
  priority: ReferralPriority;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge
      tone={priorityTone[priority]}
      size={size}
      icon={priority === 'routine' ? <Minus /> : <AlertTriangle />}
    >
      {referralPriorityLabel[priority]}
    </Badge>
  );
}

/* ── Follow-ups ────────────────────────────────────────────────────────────── */

const followUpTone: Record<FollowUpStatus, BadgeTone> = {
  scheduled: 'neutral',
  'in-progress': 'attention',
  completed: 'complete',
  unresolved: 'urgent',
};

const followUpIcon: Record<FollowUpStatus, React.ReactNode> = {
  scheduled: <CalendarClock />,
  'in-progress': <PhoneCall />,
  completed: <CheckCircle2 />,
  unresolved: <CircleSlash />,
};

export function FollowUpStatusBadge({
  status,
  size,
}: {
  status: FollowUpStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={followUpTone[status]} icon={followUpIcon[status]} size={size}>
      {followUpStatusLabel[status]}
    </Badge>
  );
}

const bucketTone: Record<FollowUpBucket, BadgeTone> = {
  overdue: 'urgent',
  'due-today': 'attention',
  upcoming: 'neutral',
  completed: 'complete',
  unresolved: 'urgent',
};

const bucketLabel: Record<FollowUpBucket, string> = {
  overdue: 'Terlambat',
  'due-today': 'Jatuh tempo hari ini',
  upcoming: 'Akan datang',
  completed: 'Selesai',
  unresolved: 'Belum terselesaikan',
};

export function FollowUpBucketBadge({
  bucket,
  size,
}: {
  bucket: FollowUpBucket;
  size?: 'sm' | 'md';
}) {
  const icon =
    bucket === 'overdue' || bucket === 'unresolved' ? (
      <AlertTriangle />
    ) : bucket === 'completed' ? (
      <CheckCircle2 />
    ) : (
      <CalendarClock />
    );
  return (
    <Badge tone={bucketTone[bucket]} icon={icon} size={size}>
      {bucketLabel[bucket]}
    </Badge>
  );
}

/* ── Sync ──────────────────────────────────────────────────────────────────── */

const syncTone: Record<SyncState, BadgeTone> = {
  'local-draft': 'inert',
  pending: 'attention',
  synced: 'complete',
  failed: 'urgent',
  conflict: 'urgent',
};

const syncIcon: Record<SyncState, React.ReactNode> = {
  'local-draft': <CloudOff />,
  pending: <CloudUpload />,
  synced: <CheckCircle2 />,
  failed: <XCircle />,
  conflict: <GitCompareArrows />,
};

export function SyncStateBadge({ state, size }: { state: SyncState; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={syncTone[state]} icon={syncIcon[state]} size={size}>
      {syncStateLabel[state]}
    </Badge>
  );
}

/* ── Facility directory confidence ─────────────────────────────────────────── */

export function FacilityInfoBadge({
  status,
  size,
}: {
  status: 'verified-sample' | 'needs-review' | 'unconfirmed';
  size?: 'sm' | 'md';
}) {
  const tone: BadgeTone =
    status === 'verified-sample' ? 'neutral' : status === 'needs-review' ? 'attention' : 'inert';
  const icon =
    status === 'verified-sample' ? (
      <ShieldCheck />
    ) : status === 'needs-review' ? (
      <RefreshCw />
    ) : (
      <ShieldQuestion />
    );
  return (
    <Badge tone={tone} icon={icon} size={size}>
      {facilityInfoStatusLabel[status]}
    </Badge>
  );
}
