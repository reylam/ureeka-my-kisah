import { useState } from 'react';
import {
  Contrast,
  ImageOff,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  SquareDashedMousePointer,
} from 'lucide-react';
import type { LesionRegion, Screening } from '@/types/domain';
import { cn } from '@/utils/cn';
import { useScreeningImage } from '@/hooks/useScreeningImage';
import { SampleRadiograph } from './SampleRadiograph';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPercent } from '@/utils/format';

/**
 * Chest radiograph viewer.
 *
 * This is the one screen that goes dark: a radiograph is unreadable against a
 * white page, and radiology workstations are dark for exactly this reason. The
 * surrounding controls stay flat and plainly labelled.
 *
 * The overlay draws the regions the demo model reported. The toggle exists so
 * the original image and the annotated view can be compared directly. An
 * overlay you cannot switch off is impossible to check.
 */
export function XrayViewer({
  screening,
  regions = [],
  showOverlayControl = true,
  defaultOverlay = false,
  className,
  onOverlayChange,
}: {
  screening: Screening;
  regions?: LesionRegion[];
  showOverlayControl?: boolean;
  defaultOverlay?: boolean;
  className?: string;
  onOverlayChange?: (visible: boolean) => void;
}) {
  const image = useScreeningImage(screening);
  const [overlay, setOverlay] = useState(defaultOverlay);
  const [zoom, setZoom] = useState(1);
  const [inverted, setInverted] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  const hasRegions = regions.length > 0;
  const overlayVisible = overlay && hasRegions;

  const setOverlayState = (next: boolean) => {
    setOverlay(next);
    onOverlayChange?.(next);
  };

  return (
    <div className={cn('on-dark overflow-hidden rounded-card bg-obsidian-950', className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 px-2.5 py-2">
        {showOverlayControl ? (
          <div
            role="group"
            aria-label="Tampilan gambar"
            className="flex items-center rounded-md bg-white/[0.06] p-0.5"
          >
            <ViewToggle
              active={!overlayVisible}
              onClick={() => setOverlayState(false)}
              icon={<SquareDashedMousePointer className="size-3.5" />}
              label="Asli"
            />
            <ViewToggle
              active={overlayVisible}
              onClick={() => setOverlayState(true)}
              icon={<Layers className="size-3.5" />}
              label="Overlay"
              disabled={!hasRegions}
              disabledHint="Tidak ada region yang dilaporkan untuk data ini"
            />
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5">
          <ViewerButton
            label="Perkecil"
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
          >
            <Minus className="size-4" />
          </ViewerButton>
          <span className="w-10 text-center text-[11px] text-obsidian-400 tabular">
            {Math.round(zoom * 100)}%
          </span>
          <ViewerButton
            label="Perbesar"
            disabled={zoom >= 3}
            onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
          >
            <Plus className="size-4" />
          </ViewerButton>
          <ViewerButton
            label="Reset tampilan"
            disabled={zoom === 1 && !inverted}
            onClick={() => {
              setZoom(1);
              setInverted(false);
            }}
          >
            <RotateCcw className="size-4" />
          </ViewerButton>
          <ViewerButton
            label={inverted ? 'Tampilkan greyscale normal' : 'Invert greyscale'}
            active={inverted}
            onClick={() => setInverted((value) => !value)}
          >
            <Contrast className="size-4" />
          </ViewerButton>
        </div>
      </div>

      {/* Viewport */}
      <div className="viewer-grid relative flex aspect-square max-h-[32rem] w-full items-center justify-center overflow-hidden">
        {image.loading ? (
          <Skeleton className="size-56 bg-white/10" />
        ) : image.missing ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <ImageOff aria-hidden className="size-6 text-obsidian-600" />
            <p className="text-[13px] font-medium text-obsidian-300">Belum ada radiograf terlampir</p>
            <p className="max-w-xs text-xs leading-relaxed text-obsidian-500">
              Data ini disimpan sebagai draf sebelum gambar ditambahkan.
            </p>
          </div>
        ) : (
          <div
            className="relative transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, width: '100%', height: '100%' }}
          >
            <div className={cn('size-full', inverted && 'invert')}>
              {image.url ? (
                <img
                  src={image.url}
                  alt={`Radiograf dada untuk data screening ${screening.id}`}
                  className="size-full object-contain"
                />
              ) : image.sample ? (
                <SampleRadiograph variant={image.sample} />
              ) : null}
            </div>

            {/* Region overlay */}
            {overlayVisible ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="Overlay region ilustratif"
                className="pointer-events-none absolute inset-0 size-full"
              >
                {regions.map((region) => {
                  const active = activeRegion === region.id;
                  return (
                    <g key={region.id}>
                      <rect
                        x={region.box.x * 100}
                        y={region.box.y * 100}
                        width={region.box.width * 100}
                        height={region.box.height * 100}
                        fill="#8DB8E8"
                        fillOpacity={active ? 0.2 : 0.1}
                        stroke="#8DB8E8"
                        strokeWidth={active ? 0.6 : 0.4}
                        vectorEffect="non-scaling-stroke"
                        rx="0.6"
                      />
                    </g>
                  );
                })}
              </svg>
            ) : null}
          </div>
        )}

        {/* Corner annotations, as a radiography workstation would show */}
        <div className="pointer-events-none absolute inset-0 p-2.5 font-mono text-[10px] tracking-wide text-obsidian-500">
          <span className="absolute top-2.5 left-2.5">PA · UPRIGHT</span>
          <span className="absolute top-2.5 right-2.5">
            {image.url ? 'DI-UPLOAD' : 'SAMPEL SINTETIS'}
          </span>
          <span className="absolute bottom-2.5 left-2.5">
            R
            <span className="ml-1 text-obsidian-600">kanan pasien</span>
          </span>
          {overlayVisible ? (
            <span className="absolute bottom-2.5 right-2.5 text-ct-400">
              OVERLAY · ILUSTRATIF
            </span>
          ) : null}
        </div>
      </div>

      {/* Region list: the overlay needs words next to it, not just boxes */}
      {overlayVisible ? (
        <ul className="divide-y divide-white/5 border-t border-white/8">
          {regions.map((region, index) => (
            <li key={region.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveRegion(region.id)}
                onMouseLeave={() => setActiveRegion(null)}
                onFocus={() => setActiveRegion(region.id)}
                onBlur={() => setActiveRegion(null)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded border border-ct-400/60 bg-ct-400/15 text-[10px] font-semibold text-ct-300 tabular"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-obsidian-200 capitalize">
                  {region.zone}
                </span>
                <span className="shrink-0 text-xs text-obsidian-400 tabular">
                  {formatPercent(region.score, 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="border-t border-white/8 px-3 py-2 text-[11px] leading-relaxed text-obsidian-500">
        {hasRegions
          ? 'Region pada overlay hanya ilustrasi. Region yang disorot adalah petunjuk untuk diperiksa, bukan bukti penyakit.'
          : 'Overlay region tidak tersedia untuk data ini.'}
      </p>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
  disabled,
  disabledHint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? disabledHint : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:text-obsidian-600',
        active
          ? 'bg-ct-400 text-obsidian-950'
          : 'text-obsidian-300 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ViewerButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded transition-colors',
        'disabled:cursor-not-allowed disabled:text-obsidian-700',
        active
          ? 'bg-ct-400/20 text-ct-300'
          : 'text-obsidian-300 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

/** Exported for the report page, which needs the same frame without controls. */
export function XrayFrame({
  screening,
  regions = [],
  showOverlay = false,
  className,
  label,
}: {
  screening: Screening;
  regions?: LesionRegion[];
  showOverlay?: boolean;
  className?: string;
  label: string;
}) {
  const image = useScreeningImage(screening);

  return (
    <figure className={cn('m-0', className)}>
      <div className="viewer-grid relative aspect-square w-full overflow-hidden rounded-md border border-obsidian-300 print:border-obsidian-400">
        {image.loading ? (
          <div className="flex size-full items-center justify-center">
            <Skeleton className="size-40 bg-white/10" />
          </div>
        ) : image.missing ? (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <Maximize2 aria-hidden className="size-5 text-obsidian-600" />
            <p className="text-xs text-obsidian-500">Tidak ada gambar</p>
          </div>
        ) : image.url ? (
          <img src={image.url} alt={label} className="size-full object-contain" />
        ) : image.sample ? (
          <SampleRadiograph variant={image.sample} />
        ) : null}

        {showOverlay && regions.length > 0 ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            className="absolute inset-0 size-full"
          >
            {regions.map((region, index) => (
              <g key={region.id}>
                <rect
                  x={region.box.x * 100}
                  y={region.box.y * 100}
                  width={region.box.width * 100}
                  height={region.box.height * 100}
                  fill="#8DB8E8"
                  fillOpacity={0.12}
                  stroke="#8DB8E8"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                  rx="0.6"
                />
                <text
                  x={region.box.x * 100 + 1.2}
                  y={region.box.y * 100 + 4}
                  fontSize="3.2"
                  fill="#EAF2FA"
                  fontFamily="ui-monospace, monospace"
                >
                  {index + 1}
                </text>
              </g>
            ))}
          </svg>
        ) : null}
      </div>
      <figcaption className="mt-1.5 text-[11px] text-obsidian-500">{label}</figcaption>
    </figure>
  );
}
