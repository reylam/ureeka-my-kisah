import { Link } from 'react-router-dom';
import { ChevronRight, ImageOff } from 'lucide-react';
import type { Screening } from '@/types/domain';
import { PriorityBadge, ScreeningOutcomeBadge, ScreeningStatusBadge } from '@/components/ui/StatusBadge';
import { riskOf } from '@/lib/risk';
import { formatDate } from '@/utils/date';

/**
 * One visit in a patient's X-ray history: the day, where it sat in the queue,
 * how urgent it was and what the model made of the film.
 */
export function ScreeningHistoryRow({ screening }: { screening: Screening }) {
  const analysis = screening.analysis;
  const risk = analysis ? riskOf(analysis) : null;

  return (
    <li>
      <Link to={`/screenings/${screening.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ct-50/70">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-obsidian-950 tabular">{formatDate(screening.requestDate)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-obsidian-500">
            {screening.queueNumber ? `Antrean ${screening.queueNumber}` : 'Belum masuk antrean'}
            {risk ? ` · risk point ${risk.point}` : ''}
            {!screening.hasImage ? (
              <span className="inline-flex items-center gap-1">
                · <ImageOff aria-hidden className="size-3" /> tanpa gambar
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {screening.queuePriority ? (
              <PriorityBadge priority={screening.queuePriority} size="sm" />
            ) : (
              <ScreeningStatusBadge status={screening.status} size="sm" />
            )}
            {analysis ? <ScreeningOutcomeBadge outcome={analysis.outcome} short size="sm" /> : null}
          </div>
        </div>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-obsidian-400" />
      </Link>
    </li>
  );
}
