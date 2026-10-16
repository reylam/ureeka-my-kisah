import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/date';
import type { TimelineEntry, TimelineTone } from './buildTimeline';

/**
 * Patient timeline renderer.
 *
 * Entries are produced by `buildTimeline`, which merges screenings, reviews,
 * referral status changes, contact attempts and notes into one chronological
 * list. This component only draws them.
 */

const toneClasses: Record<TimelineTone, string> = {
  neutral: 'bg-obsidian-100 text-obsidian-500 ring-obsidian-200',
  ct: 'bg-ct-100 text-ct-700 ring-ct-200',
  attention: 'bg-attention-50 text-attention-700 ring-attention-300/70',
  urgent: 'bg-urgent-50 text-urgent-700 ring-urgent-300/70',
  complete: 'bg-complete-50 text-complete-700 ring-complete-300/70',
};

export function PatientTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-obsidian-500">
        Belum ada catatan apa pun untuk pasien ini.
      </p>
    );
  }

  return (
    <ol className="relative px-4 py-1">
      {/* The spine */}
      <span aria-hidden className="absolute top-4 bottom-4 left-[27px] w-px bg-obsidian-200" />

      {entries.map((entry) => {
        const Icon = entry.icon;
        const inner = (
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-medium text-obsidian-900">{entry.title}</span>
              <span className="text-[11px] text-obsidian-400 tabular">
                {formatDateTime(entry.at)}
              </span>
            </span>
            {entry.body ? (
              <span className="mt-1 block text-[13px] leading-relaxed text-obsidian-600">
                {entry.body}
              </span>
            ) : null}
            {entry.actor ? (
              <span className="mt-1 block text-[11px] text-obsidian-400">{entry.actor}</span>
            ) : null}
          </span>
        );

        return (
          <li key={entry.id} className="relative flex gap-3 py-3">
            <span
              aria-hidden
              className={cn(
                'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 [&>svg]:size-3.5',
                toneClasses[entry.tone],
              )}
            >
              <Icon />
            </span>
            {entry.to ? (
              <Link
                to={entry.to}
                className="-my-1 flex min-w-0 flex-1 rounded-md px-2 py-1 transition-colors hover:bg-ct-50/70"
              >
                {inner}
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 px-2 py-1">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
