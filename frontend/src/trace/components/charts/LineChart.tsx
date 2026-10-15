import { Axes, linePath, makeScales, PALETTE, type Plot } from './ResearchChart';

/**
 * Multi-series line chart over an integer x axis. Used for training curves,
 * where the thing worth seeing is two series diverging rather than any single
 * value, so there are no data labels and no tooltip — just the shapes.
 */

const PLOT: Plot = {
  width: 420,
  height: 250,
  padding: { top: 12, right: 14, bottom: 34, left: 44 },
};

export interface Series {
  id: string;
  colour: string;
  dashed?: boolean;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  xDomain,
  yDomain,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  marker,
  formatY = (value) => value.toFixed(2),
  ariaLabel,
}: {
  series: Series[];
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: number[];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
  /** Vertical rule, e.g. the selected epoch. */
  marker?: { x: number; label: string };
  formatY?: (value: number) => string;
  /** A `role="img"` element needs a name. Summarise the trend in a sentence. */
  ariaLabel: string;
}) {
  const scales = makeScales(PLOT, { x: xDomain, y: yDomain });

  return (
    <svg
      viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <Axes
        plot={PLOT}
        scales={scales}
        xTicks={xTicks}
        yTicks={yTicks}
        xLabel={xLabel}
        yLabel={yLabel}
        formatY={formatY}
      />

      {marker ? (
        <g>
          <line
            x1={scales.x(marker.x)}
            x2={scales.x(marker.x)}
            y1={PLOT.padding.top}
            y2={PLOT.height - PLOT.padding.bottom}
            stroke={PALETTE.flag}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <text
            x={scales.x(marker.x) + 5}
            y={PLOT.padding.top + 10}
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill={PALETTE.flag}
          >
            {marker.label}
          </text>
        </g>
      ) : null}

      {series.map((item) => (
        <path
          key={item.id}
          d={linePath(item.points, scales)}
          fill="none"
          stroke={item.colour}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeDasharray={item.dashed ? '4 3' : undefined}
        />
      ))}
    </svg>
  );
}
