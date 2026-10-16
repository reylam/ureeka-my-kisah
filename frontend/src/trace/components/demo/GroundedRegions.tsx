import { useState } from 'react';
import { Flame, SquareDashed } from 'lucide-react';
import type { ClassLabel, LesionRegion } from '@/types/domain';
import { cn } from '@/utils/cn';

/**
 * The film with the areas the model leaned on, each box grounded to a class.
 *
 * Every box carries its own tag (number, class, weight) on the
 * image itself, and the list underneath says the same in words, so a box is
 * never just a shape: it is "this area carried the TB score by this much".
 * Hovering either one lights up the other.
 *
 * Both layers can be switched off. An overlay that cannot be removed cannot be
 * checked against the film underneath it.
 */

const LABEL_NAME: Record<ClassLabel, string> = {
  Healthy: 'Sehat',
  'Sick-non-TB': 'Sakit, bukan TB',
  TB: 'TB',
};

// The film stays dark in both themes, so these are fixed rather than tokens.
const TONE: Record<ClassLabel, { edge: string; tag: string }> = {
  TB: { edge: '#f5b544', tag: 'bg-[#f5b544] text-[#1d1405]' },
  'Sick-non-TB': { edge: '#7cc0f2', tag: 'bg-[#7cc0f2] text-[#06131d]' },
  Healthy: { edge: '#b7bec9', tag: 'bg-[#b7bec9] text-[#0a0c10]' },
};

/** Weight against the strongest area, which is 100. */
const weight = (score: number) => Math.round(score * 100);

export function GroundedRegions({
  imageUrl,
  imageName,
  regions,
  heatmapUrl,
  note,
}: {
  imageUrl: string;
  imageName: string;
  regions: LesionRegion[];
  heatmapUrl: string | null;
  note: string | null;
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const hasRegions = regions.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="trace-label text-trace-dim">Area yang dipakai model</p>
        {hasRegions ? (
          <div className="flex gap-2">
            <Toggle pressed={showBoxes} onChange={setShowBoxes} icon={SquareDashed}>
              Kotak
            </Toggle>
            {heatmapUrl ? (
              <Toggle pressed={showHeat} onChange={setShowHeat} icon={Flame}>
                Peta panas
              </Toggle>
            ) : null}
          </div>
        ) : null}
      </div>

      <figure className="mt-3 overflow-hidden rounded-md border border-trace-line">
        <div className="flex justify-center bg-trace-film p-3">
          <div className="relative inline-block max-w-full">
            <img
              src={imageUrl}
              alt={
                hasRegions
                  ? `X-ray ${imageName} dengan ${regions.length} kotak area yang dipakai model.`
                  : `X-ray ${imageName}.`
              }
              className="block max-h-[480px] w-auto max-w-full"
            />
            {showHeat && heatmapUrl ? (
              <img
                src={heatmapUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full mix-blend-screen"
              />
            ) : null}
            {showBoxes
              ? regions.map((region, index) => {
                  const label = region.label ?? 'TB';
                  const tone = TONE[label];
                  const lit = active === region.id;
                  const nearTop = region.box.y < 0.06;
                  // Keep the tag on the film when the box hugs the right edge.
                  const nearRight = region.box.x + region.box.width > 0.7;
                  return (
                    <div
                      key={region.id}
                      aria-hidden
                      onMouseEnter={() => setActive(region.id)}
                      onMouseLeave={() => setActive(null)}
                      className="absolute rounded-[3px] transition-[box-shadow,opacity]"
                      style={{
                        left: `${region.box.x * 100}%`,
                        top: `${region.box.y * 100}%`,
                        width: `${region.box.width * 100}%`,
                        height: `${region.box.height * 100}%`,
                        border: `${lit ? 3 : 2}px solid ${tone.edge}`,
                        boxShadow: lit ? `0 0 0 3px ${tone.edge}55` : undefined,
                        opacity: active && !lit ? 0.45 : 1,
                      }}
                    >
                      <span
                        className={cn(
                          'absolute rounded-[3px] px-1.5 py-px font-mono text-[10px] leading-4 font-medium whitespace-nowrap',
                          nearTop ? 'top-0.5' : '-top-[18px]',
                          nearRight
                            ? nearTop ? 'right-0.5' : 'right-[-1.5px]'
                            : nearTop ? 'left-0.5' : 'left-[-1.5px]',
                          tone.tag,
                        )}
                      >
                        {index + 1} · {LABEL_NAME[label]} · {weight(region.score)}
                      </span>
                    </div>
                  );
                })
              : null}
          </div>
        </div>
        <figcaption className="border-t border-trace-line bg-trace-card px-4 py-3 text-[12.5px] leading-5 text-trace-dim">
          {hasRegions
            ? 'Kotak menandai bagian gambar yang, bila ditutup, paling menurunkan score kelas teratas. Itu bagian yang dipakai model untuk jawabannya, bukan lesi yang sudah dipastikan. Kanan dan kiri mengikuti sisi pasien, jadi kanan pasien ada di sisi kiri gambar.'
            : (note ?? 'Tidak ada area yang ditandai untuk gambar ini.')}
        </figcaption>
      </figure>

      {hasRegions ? (
        <ol className="mt-3 divide-y divide-trace-line rounded-md border border-trace-line">
          {regions.map((region, index) => {
            const label = region.label ?? 'TB';
            const lit = active === region.id;
            return (
              <li key={region.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(region.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(region.id)}
                  onBlur={() => setActive(null)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                    lit ? 'bg-trace-raised' : 'bg-trace-card',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded font-mono text-[11px] font-medium',
                      TONE[label].tag,
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-trace-text">
                      {LABEL_NAME[label]} <span className="text-trace-dim">·</span>{' '}
                      <span className="text-trace-muted">{region.zone}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-5 text-trace-dim">
                      {index === 0
                        ? `Area paling berpengaruh: bila ditutup, score ${LABEL_NAME[label]} turun paling jauh. Bobot 100.`
                        : `Bila ditutup, score ${LABEL_NAME[label]} ikut turun. Bobot ${weight(region.score)} dibanding area nomor 1.`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function Toggle({
  pressed,
  onChange,
  icon: Icon,
  children,
}: {
  pressed: boolean;
  onChange: (next: boolean) => void;
  icon: typeof Flame;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors',
        pressed
          ? 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft'
          : 'border-trace-line bg-trace-card text-trace-dim hover:text-trace-muted',
      )}
    >
      <Icon aria-hidden className="size-3" />
      {children}
    </button>
  );
}
