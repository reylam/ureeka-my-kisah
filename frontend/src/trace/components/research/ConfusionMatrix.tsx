import type { ConfusionMatrixData } from '@/trace/types';
import { ProvenanceBadge } from '@/trace/components/ui/ProvenanceBadge';
import { formatCount } from '@/trace/lib/format';
import { cn } from '@/utils/cn';

/**
 * A 2×2 confusion matrix with the four cells named.
 *
 * Two decisions worth stating. First, the cells are labelled TN / FP / FN / TP
 * in words as well as counts, because "the top-right number" is where most
 * misreadings of a confusion matrix begin. Second, the shading is a single blue
 * ramp by magnitude — not green for correct and red for wrong. Colour-coding a
 * false positive as "bad" and a true negative as "good" smuggles in a clinical
 * judgement the matrix does not contain.
 */

const CELL_NAMES = [
  ['True negative', 'False positive'],
  ['False negative', 'True positive'],
];

const CELL_MEANING = [
  ['Not flagged, reference non-TB', 'Flagged, reference non-TB'],
  ['Not flagged, reference TB', 'Flagged, reference TB'],
];

export function ConfusionMatrix({
  data,
  thresholdLabel,
  className,
}: {
  data: ConfusionMatrixData;
  thresholdLabel?: string;
  className?: string;
}) {
  const max = Math.max(...data.counts.flat(), 1);

  return (
    <figure
      className={cn(
        'flex h-full flex-col rounded-md border border-trace-line bg-trace-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-trace-line px-4 py-3">
        <div>
          <h4 className="text-[14.5px] font-medium text-trace-text">Confusion matrix</h4>
          <p className="mt-0.5 text-[12.5px] text-trace-dim">
            {thresholdLabel ?? 'At the selected operating threshold'}
          </p>
        </div>
        <ProvenanceBadge provenance={data.provenance} />
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <td className="w-24" />
              <th
                scope="colgroup"
                colSpan={2}
                className="trace-label pb-2 text-center font-normal text-trace-dim"
              >
                Model output
              </th>
            </tr>
            <tr>
              <td />
              <th scope="col" className="pb-2 text-center text-[12px] font-medium text-trace-muted">
                Not flagged
              </th>
              <th scope="col" className="pb-2 text-center text-[12px] font-medium text-trace-muted">
                Flagged
              </th>
            </tr>
          </thead>
          <tbody>
            {data.counts.map((row, rowIndex) => (
              <tr key={data.classNames[rowIndex] ?? rowIndex}>
                <th
                  scope="row"
                  className="w-24 pr-3 text-right align-middle text-[12px] font-medium text-trace-muted"
                >
                  {data.classNames[rowIndex]}
                </th>
                {row.map((count, columnIndex) => (
                  <td key={columnIndex} className="p-1">
                    <div
                      className="rounded border border-trace-line px-3 py-3 text-center"
                      style={{
                        backgroundColor: `rgb(91 159 232 / ${(0.06 + 0.3 * (count / max)).toFixed(3)})`,
                      }}
                    >
                      <p className="font-mono text-[20px] leading-none tabular-nums text-trace-text">
                        {formatCount(count)}
                      </p>
                      <p className="mt-1.5 text-[11px] font-medium text-trace-muted">
                        {CELL_NAMES[rowIndex]?.[columnIndex]}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-4 text-trace-dim">
                        {CELL_MEANING[rowIndex]?.[columnIndex]}
                      </p>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="mt-auto border-t border-trace-line px-4 py-3 text-[12.5px] leading-5 text-trace-dim">
        Rows are the reference label, columns are the model output. Every rate reported elsewhere is
        a ratio of these four counts, which is why the counts are published with them.
        <span className="mt-1 block font-mono text-[11px] tracking-[0.04em]">
          n = {formatCount(data.support)} images
        </span>
      </figcaption>
    </figure>
  );
}
