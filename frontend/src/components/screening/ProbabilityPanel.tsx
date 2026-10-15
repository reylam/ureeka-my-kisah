import type { ClassLabel, ScreeningAnalysis } from '@/types/domain';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/format';

/**
 * Class score breakdown.
 *
 * Shows the whole distribution, not just the winning class. A 0.51/0.49 split
 * and a 0.98/0.01 split mean very different things to a reviewer, and hiding
 * the runner-up conceals exactly that.
 *
 * The bars use CT blue for the leading class and neutral grey for the rest.
 * Status colours are kept out of this panel deliberately: these are model
 * scores, not clinical states.
 */

const LABEL_DESCRIPTION: Record<ClassLabel, string> = {
  Healthy: 'No abnormality associated with the training labels',
  'Sick-non-TB': 'Abnormality present, but not labelled as TB in training',
  TB: 'Features the model associates with TB in its training data',
};

export function ProbabilityPanel({
  analysis,
  className,
}: {
  analysis: ScreeningAnalysis;
  className?: string;
}) {
  const entries = (Object.entries(analysis.probabilities) as [ClassLabel, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const [leader] = entries;
  const runnerUp = entries[1];
  const margin = leader && runnerUp ? leader[1] - runnerUp[1] : 1;

  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-2.5">
        {entries.map(([label, value], index) => {
          const leading = index === 0;
          return (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    'text-[13px]',
                    leading ? 'font-semibold text-obsidian-950' : 'text-obsidian-600',
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-[13px] tabular',
                    leading ? 'font-semibold text-obsidian-950' : 'text-obsidian-500',
                  )}
                >
                  {formatPercent(value)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-obsidian-100">
                <div
                  className={cn(
                    'h-full rounded-full',
                    leading ? 'bg-ct-500' : 'bg-obsidian-300',
                  )}
                  style={{ width: `${Math.max(1, value * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-obsidian-500">
                {LABEL_DESCRIPTION[label]}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-obsidian-100 pt-2.5 text-xs leading-relaxed text-obsidian-500">
        {margin < 0.15 ? (
          <>
            The top two classes are within {formatPercent(margin)} of each other, so the
            distribution does not favour one answer. Treat the output as unresolved.
          </>
        ) : (
          <>
            The leading class is {formatPercent(margin)} ahead of the next one. These are the demo
            simulator&rsquo;s own scores and are not calibrated against any real population.
          </>
        )}
      </p>
    </div>
  );
}
