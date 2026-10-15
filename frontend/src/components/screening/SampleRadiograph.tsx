import { useId } from 'react';
import type { SampleRadiograph as SampleId } from '@/types/domain';
import { cn } from '@/utils/cn';

/**
 * Synthetic chest radiograph, drawn in SVG.
 *
 * The seed records need an image to display, and using real chest X-rays from
 * a public dataset would mean putting actual (de-identified but real) patient
 * imaging into a demo. These are drawn from primitives instead: a thorax
 * silhouette, rib arcs, a mediastinal shadow and diaphragm curves.
 *
 * They are deliberately watermarked SYNTHETIC. Nobody should mistake one for a
 * real radiograph, and nothing in the app claims they were analysed.
 *
 * Variants:
 *   sample-a  upper-zone opacities present (pairs with a flagged record)
 *   sample-b  unremarkable fields
 *   sample-c  underexposed and rotated (pairs with an inconclusive record)
 */

interface Variant {
  /** Overall exposure: lower = darker, more washed-out film. */
  exposure: number;
  /** Rotation in degrees, to mimic poor patient positioning. */
  rotation: number;
  /** Extra opacities, in normalised thorax coordinates. */
  opacities: { cx: number; cy: number; r: number; strength: number }[];
  /** Simulated motion blur, in user units. */
  blur: number;
}

const VARIANTS: Record<SampleId, Variant> = {
  'sample-a': {
    exposure: 1,
    rotation: 0,
    opacities: [
      { cx: 318, cy: 300, r: 52, strength: 0.42 },
      { cx: 352, cy: 262, r: 30, strength: 0.3 },
    ],
    blur: 0,
  },
  'sample-b': {
    exposure: 1,
    rotation: 0,
    opacities: [],
    blur: 0,
  },
  'sample-c': {
    exposure: 0.62,
    rotation: -4.5,
    opacities: [],
    blur: 2.4,
  },
};

export function SampleRadiograph({
  variant,
  className,
  showWatermark = true,
}: {
  variant: SampleId;
  className?: string;
  showWatermark?: boolean;
}) {
  const uid = useId().replace(/[:]/g, '');
  const config = VARIANTS[variant];

  const lungGradient = `lung-${uid}`;
  const filmGradient = `film-${uid}`;
  const blurFilter = `blur-${uid}`;
  const clipLeft = `clipL-${uid}`;
  const clipRight = `clipR-${uid}`;

  // Rib arcs, generated so they fan out naturally down the thorax.
  const ribs = Array.from({ length: 8 }, (_, i) => 150 + i * 56);

  return (
    <svg
      viewBox="0 0 800 800"
      role="img"
      aria-label="Synthetic sample chest radiograph used for demonstration"
      className={cn('block h-full w-full', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={lungGradient} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#8f98a4" stopOpacity={0.95 * config.exposure} />
          <stop offset="55%" stopColor="#5e6773" stopOpacity={0.8 * config.exposure} />
          <stop offset="100%" stopColor="#2b313a" stopOpacity={0.55 * config.exposure} />
        </radialGradient>

        <radialGradient id={filmGradient} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#1b1f26" />
          <stop offset="100%" stopColor="#0a0c10" />
        </radialGradient>

        <filter id={blurFilter}>
          <feGaussianBlur stdDeviation={config.blur || 0.6} />
        </filter>

        {/* Lung fields double as clip paths so ribs stay inside the thorax */}
        <clipPath id={clipRight}>
          <path d="M335 168c-58 8-104 54-120 126-16 72-14 158 6 224 12 40 36 62 66 56 28-6 44-34 48-78 8-92 10-216 4-306-1-14-1-22-4-22z" />
        </clipPath>
        <clipPath id={clipLeft}>
          <path d="M465 168c58 8 104 54 120 126 16 72 14 158-6 224-12 40-36 62-66 56-28-6-44-34-48-78-8-92-10-216-4-306 1-14 1-22 4-22z" />
        </clipPath>
      </defs>

      {/* Film base */}
      <rect width="800" height="800" fill={`url(#${filmGradient})`} />

      <g
        transform={`rotate(${config.rotation} 400 400)`}
        filter={config.blur > 0 ? `url(#${blurFilter})` : undefined}
      >
        {/* Soft tissue shoulders */}
        <path
          d="M190 250c40-70 110-112 210-112s170 42 210 112c22 38 30 90 30 150 0 150-34 290-96 340H256c-62-50-96-190-96-340 0-60 8-112 30-150z"
          fill="#3a4049"
          opacity={0.55 * config.exposure}
        />

        {/* Lung fields */}
        <path
          d="M335 168c-58 8-104 54-120 126-16 72-14 158 6 224 12 40 36 62 66 56 28-6 44-34 48-78 8-92 10-216 4-306-1-14-1-22-4-22z"
          fill={`url(#${lungGradient})`}
        />
        <path
          d="M465 168c58 8 104 54 120 126 16 72 14 158-6 224-12 40-36 62-66 56-28-6-44-34-48-78-8-92-10-216-4-306 1-14 1-22 4-22z"
          fill={`url(#${lungGradient})`}
        />

        {/* Ribs, clipped to each lung field */}
        {([clipRight, clipLeft] as const).map((clip, side) => (
          <g key={clip} clipPath={`url(#${clip})`} opacity={0.5 * config.exposure}>
            {ribs.map((y, index) => {
              const direction = side === 0 ? 1 : -1;
              const spread = 90 + index * 14;
              return (
                <path
                  key={y}
                  d={`M${400 - direction * 60} ${y - 40} q ${-direction * spread} ${28 + index * 6} ${-direction * (spread * 0.92)} ${96 + index * 10}`}
                  stroke="#c6cdd6"
                  strokeWidth={7}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.6}
                />
              );
            })}
          </g>
        ))}

        {/* Spine and mediastinum */}
        <rect
          x="384"
          y="150"
          width="32"
          height="430"
          rx="14"
          fill="#aab2bd"
          opacity={0.42 * config.exposure}
        />
        {Array.from({ length: 11 }, (_, i) => (
          <rect
            key={i}
            x="382"
            y={158 + i * 38}
            width="36"
            height="4"
            rx="2"
            fill="#0d1014"
            opacity={0.4 * config.exposure}
          />
        ))}

        {/* Cardiac shadow, offset left as it should be */}
        <path
          d="M404 330c44 4 78 36 86 92 8 54-14 104-54 124-28 14-46 2-50-28-8-62-6-150-4-180 1-6 10-9 22-8z"
          fill="#9aa3af"
          opacity={0.5 * config.exposure}
        />

        {/* Clavicles */}
        <path
          d="M250 212q78-34 144-18"
          stroke="#c6cdd6"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
          opacity={0.55 * config.exposure}
        />
        <path
          d="M550 212q-78-34-144-18"
          stroke="#c6cdd6"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
          opacity={0.55 * config.exposure}
        />

        {/* Diaphragm */}
        <path
          d="M196 556q104 62 204 48 100 14 204-48l0 64H196z"
          fill="#4a515b"
          opacity={0.72 * config.exposure}
        />

        {/* Variant-specific opacities */}
        {config.opacities.map((opacity, index) => (
          <g key={index}>
            <circle
              cx={opacity.cx}
              cy={opacity.cy}
              r={opacity.r}
              fill="#dde3ea"
              opacity={opacity.strength * 0.55}
              filter={`url(#${blurFilter})`}
            />
            <circle
              cx={opacity.cx}
              cy={opacity.cy}
              r={opacity.r * 0.55}
              fill="#eef2f6"
              opacity={opacity.strength * 0.7}
              filter={`url(#${blurFilter})`}
            />
          </g>
        ))}
      </g>

      {/* Film edge vignette */}
      <rect
        width="800"
        height="800"
        fill="none"
        stroke="#000"
        strokeWidth="40"
        opacity="0.35"
      />

      {showWatermark ? (
        <g opacity="0.5">
          <text
            x="400"
            y="736"
            textAnchor="middle"
            fontSize="26"
            letterSpacing="7"
            fill="#8DB8E8"
            fontFamily="ui-monospace, monospace"
          >
            SYNTHETIC SAMPLE
          </text>
          <text
            x="400"
            y="766"
            textAnchor="middle"
            fontSize="16"
            letterSpacing="2"
            fill="#6a7686"
            fontFamily="ui-monospace, monospace"
          >
            not a real radiograph
          </text>
        </g>
      ) : null}
    </svg>
  );
}
