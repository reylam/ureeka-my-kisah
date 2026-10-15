import type { Point } from '@/trace/types';
import { Axes, linePath, makeScales, PALETTE, type Plot } from './ResearchChart';

/**
 * Unit-square curve plot for ROC and precision-recall.
 *
 * Both curves live in [0,1]², both need a no-skill baseline drawn in, and both
 * need the deployed operating point marked — a curve without the operating
 * point invites the reader to imagine the best corner of it.
 */

const PLOT: Plot = {
  width: 360,
  height: 330,
  padding: { top: 12, right: 14, bottom: 34, left: 44 },
};

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

export function CurveChart({
  points,
  operatingPoint,
  baseline,
  xLabel,
  yLabel,
  operatingLabel,
  ariaLabel,
}: {
  points: Point[];
  operatingPoint?: Point;
  /** `diagonal` for ROC chance; a number draws a horizontal no-skill line. */
  baseline: 'diagonal' | number;
  xLabel: string;
  yLabel: string;
  operatingLabel?: string;
  /** An `role="img"` element needs a name. Summarise the curve in a sentence. */
  ariaLabel: string;
}) {
  const scales = makeScales(PLOT, { x: [0, 1], y: [0, 1] });
  const area = `${linePath(points, scales)} L${scales.x(points[points.length - 1]?.x ?? 1)} ${scales.y(
    typeof baseline === 'number' ? baseline : 0,
  )} L${scales.x(points[0]?.x ?? 0)} ${scales.y(typeof baseline === 'number' ? baseline : 0)} Z`;

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
        xTicks={TICKS}
        yTicks={TICKS}
        xLabel={xLabel}
        yLabel={yLabel}
        formatX={(value) => value.toFixed(1)}
        formatY={(value) => value.toFixed(1)}
      />

      {/* No-skill reference */}
      {baseline === 'diagonal' ? (
        <line
          x1={scales.x(0)}
          y1={scales.y(0)}
          x2={scales.x(1)}
          y2={scales.y(1)}
          stroke={PALETTE.neutral}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ) : (
        <line
          x1={scales.x(0)}
          y1={scales.y(baseline)}
          x2={scales.x(1)}
          y2={scales.y(baseline)}
          stroke={PALETTE.neutral}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      )}

      <path d={area} fill={PALETTE.accent} fillOpacity={0.1} stroke="none" />
      <path
        d={linePath(points, scales)}
        fill="none"
        stroke={PALETTE.accent}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />

      {points.map((point) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={scales.x(point.x)}
          cy={scales.y(point.y)}
          r={1.8}
          fill={PALETTE.accent}
        />
      ))}

      {operatingPoint ? (
        <g>
          <line
            x1={scales.x(operatingPoint.x)}
            y1={scales.y(0)}
            x2={scales.x(operatingPoint.x)}
            y2={scales.y(operatingPoint.y)}
            stroke={PALETTE.flag}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <circle
            cx={scales.x(operatingPoint.x)}
            cy={scales.y(operatingPoint.y)}
            r={4}
            fill="#15181e"
            stroke={PALETTE.flag}
            strokeWidth={2}
          />
          {operatingLabel ? (
            <text
              x={scales.x(operatingPoint.x) + 9}
              y={scales.y(operatingPoint.y) + 13}
              fontSize={10}
              fontFamily="ui-monospace, monospace"
              fill={PALETTE.flag}
            >
              {operatingLabel}
            </text>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
