import {
  AlertTriangle,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  CircleHelp,
  Hourglass,
  ListOrdered,
  Minus,
  ScanLine,
  Stethoscope,
} from 'lucide-react';
import type { ImageQuality, QueuePriority, ScreeningOutcome, ScreeningStatus } from '@/types/domain';
import { Badge, type BadgeTone } from './Badge';
import { PRIORITY_LABEL } from '@/lib/queue';
import { imageQualityLabel, screeningOutcomeLabel, screeningOutcomeShort, screeningStatusLabel } from '@/utils/labels';

/**
 * Status rendering in one place, so a status looks the same on every screen.
 *
 *   neutral/inert  informational or finished states
 *   attention      something is waiting on a person
 *   urgent         needs to happen first
 *   info (CT blue) neutral facts, never a clinical meaning
 */

/* ── Where the visit is ───────────────────────────────────────────────────── */

const statusTone: Record<ScreeningStatus, BadgeTone> = {
  waiting: 'attention',
  examining: 'info',
  queued: 'neutral',
  served: 'inert',
};

const statusIcon: Record<ScreeningStatus, React.ReactNode> = {
  waiting: <Hourglass />,
  examining: <ScanLine />,
  queued: <ListOrdered />,
  served: <CheckCircle2 />,
};

export function ScreeningStatusBadge({ status, size }: { status: ScreeningStatus; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={statusTone[status]} icon={statusIcon[status]} size={size}>
      {screeningStatusLabel[status]}
    </Badge>
  );
}

/* ── Queue priority ───────────────────────────────────────────────────────── */

const priorityTone: Record<QueuePriority, BadgeTone> = {
  high: 'urgent',
  medium: 'attention',
  low: 'neutral',
};

const priorityIcon: Record<QueuePriority, React.ReactNode> = {
  high: <ChevronsUp />,
  medium: <Minus />,
  low: <ChevronsDown />,
};

export function PriorityBadge({ priority, size }: { priority: QueuePriority; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={priorityTone[priority]} icon={priorityIcon[priority]} size={size}>
      Prioritas {PRIORITY_LABEL[priority].toLowerCase()}
    </Badge>
  );
}

/* ── The model's reading ──────────────────────────────────────────────────── */

/**
 * No green for "no alert": an absent alert is not a clean bill of health, and
 * green would say otherwise.
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
    <Badge tone={outcomeTone[outcome]} icon={outcomeIcon[outcome]} size={size} title={screeningOutcomeLabel[outcome]}>
      {short ? screeningOutcomeShort[outcome] : screeningOutcomeLabel[outcome]}
    </Badge>
  );
}

/* ── Image quality ────────────────────────────────────────────────────────── */

const qualityTone: Record<ImageQuality, BadgeTone> = {
  adequate: 'neutral',
  borderline: 'attention',
  inadequate: 'urgent',
};

export function ImageQualityBadge({ quality, size }: { quality: ImageQuality; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={qualityTone[quality]} size={size} icon={quality === 'adequate' ? <CheckCircle2 /> : <AlertTriangle />}>
      Gambar {imageQualityLabel[quality].toLowerCase()}
    </Badge>
  );
}
