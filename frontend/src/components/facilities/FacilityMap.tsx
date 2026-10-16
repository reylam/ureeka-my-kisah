import { useMemo, useState } from 'react';
import { Crosshair, Info } from 'lucide-react';
import type { Facility } from '@/types/domain';
import { cn } from '@/utils/cn';
import { facilityTypeLabel } from '@/utils/labels';
import { formatDistance, formatTravelTime } from '@/utils/format';
import { OPERATING_FACILITY_ID } from '@/data/facilities';

/**
 * Schematic facility map.
 *
 * No mapping provider is configured, so this does not pretend to be a real
 * map: there is no basemap, no roads and no geographic accuracy claim. It is a
 * relative-position plot of the sample coordinates, which is genuinely useful
 * for seeing how far apart the facilities are, and it is labelled as schematic
 * so nobody navigates by it.
 *
 * Swapping in a real provider later means replacing this component; the
 * facility records already carry `coordinates`.
 */

const PADDING = 9; // percent, keeps markers off the edge

const TYPE_STYLE: Record<Facility['type'], { ring: string; fill: string }> = {
  posyandu: { ring: 'ring-obsidian-400', fill: 'bg-obsidian-200' },
  puskesmas: { ring: 'ring-ct-500', fill: 'bg-ct-300' },
  clinic: { ring: 'ring-obsidian-400', fill: 'bg-obsidian-100' },
  'district-hospital': { ring: 'ring-ct-700', fill: 'bg-ct-500' },
  'referral-hospital': { ring: 'ring-obsidian-900', fill: 'bg-obsidian-800' },
  lab: { ring: 'ring-attention-500', fill: 'bg-attention-300' },
};

export function FacilityMap({
  facilities,
  selectedId,
  onSelect,
  className,
}: {
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  /** Project lat/lng into percentage positions within the plot area. */
  const points = useMemo(() => {
    // Entries without coordinates (new, not yet located) are listed elsewhere
    // but not plotted: a guessed position would be a wrong one.
    const located = facilities.filter(
      (f): f is Facility & { coordinates: { lat: number; lng: number } } => f.coordinates !== null,
    );
    if (located.length === 0) return [];

    const lats = located.map((f) => f.coordinates.lat);
    const lngs = located.map((f) => f.coordinates.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 1;
    const lngSpan = maxLng - minLng || 1;
    const usable = 100 - PADDING * 2;

    return located.map((facility) => ({
      facility,
      // Latitude increases northwards, so it is inverted for screen space.
      top: PADDING + ((maxLat - facility.coordinates.lat) / latSpan) * usable,
      left: PADDING + ((facility.coordinates.lng - minLng) / lngSpan) * usable,
    }));
  }, [facilities]);

  const active = hovered ?? selectedId;
  const activePoint = points.find((point) => point.facility.id === active);

  if (facilities.length === 0) {
    return (
      <div
        className={cn(
          'flex aspect-[4/3] items-center justify-center rounded-card border border-obsidian-200 bg-obsidian-50',
          className,
        )}
      >
        <p className="text-[13px] text-obsidian-500">Tidak ada fasilitas yang cocok dengan filter ini.</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-obsidian-200', className)}>
      {/* Plot area */}
      <div className="relative aspect-[4/3] w-full bg-ice">
        {/* Graticule, to signal "schematic" rather than "satellite" */}
        <svg aria-hidden className="absolute inset-0 size-full" preserveAspectRatio="none">
          <defs>
            <pattern id="facility-grid" width="10%" height="10%" patternUnits="objectBoundingBox">
              <path
                d="M 0 0 L 0 100"
                stroke="rgb(141 184 232 / 0.35)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M 0 0 L 100 0"
                stroke="rgb(141 184 232 / 0.35)"
                strokeWidth="1"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#facility-grid)" />
        </svg>

        {/* Connector from the operating facility to the hovered one */}
        {activePoint && activePoint.facility.id !== OPERATING_FACILITY_ID ? (
          (() => {
            const origin = points.find((p) => p.facility.id === OPERATING_FACILITY_ID);
            if (!origin) return null;
            return (
              <svg aria-hidden className="absolute inset-0 size-full">
                <line
                  x1={`${origin.left}%`}
                  y1={`${origin.top}%`}
                  x2={`${activePoint.left}%`}
                  y2={`${activePoint.top}%`}
                  stroke="#4b80ba"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              </svg>
            );
          })()
        ) : null}

        {/* Markers */}
        <ul className="absolute inset-0">
          {points.map(({ facility, top, left }) => {
            const isOperating = facility.id === OPERATING_FACILITY_ID;
            const isActive = facility.id === active;
            const style = TYPE_STYLE[facility.type];

            return (
              <li
                key={facility.id}
                className="absolute"
                style={{ top: `${top}%`, left: `${left}%` }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(facility.id)}
                  onMouseEnter={() => setHovered(facility.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(facility.id)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${facility.name}, ${facilityTypeLabel[facility.type]}, ${formatDistance(facility.distanceKm)} dari sini`}
                  aria-pressed={facility.id === selectedId}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <span
                    className={cn(
                      'block rounded-full ring-2 transition-all',
                      style.fill,
                      style.ring,
                      isOperating ? 'size-4' : 'size-3',
                      isActive && 'scale-125 ring-offset-2 ring-offset-ice',
                    )}
                  />
                  {isOperating ? (
                    <span
                      aria-hidden
                      className="absolute -inset-2 animate-none rounded-full border border-ct-500/40"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Hover card */}
        {activePoint ? (
          <div
            role="status"
            className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-md border border-obsidian-200 bg-white/97 px-3 py-2.5 shadow-overlay sm:left-auto sm:max-w-xs"
          >
            <p className="text-[13px] font-medium text-obsidian-950">
              {activePoint.facility.name}
            </p>
            <p className="mt-0.5 text-xs text-obsidian-500">
              {facilityTypeLabel[activePoint.facility.type]} · {activePoint.facility.region}
            </p>
            {activePoint.facility.id !== OPERATING_FACILITY_ID ? (
              <p className="mt-1 text-xs text-obsidian-600 tabular">
                {formatDistance(activePoint.facility.distanceKm)} ·{' '}
                {formatTravelTime(activePoint.facility.travelTimeMinutes)} perjalanan
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ct-700">
                <Crosshair aria-hidden className="size-3" />
                Fasilitasmu
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Legend and disclaimer */}
      <div className="border-t border-obsidian-200 bg-white px-3 py-2.5">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(
            [
              'referral-hospital',
              'district-hospital',
              'puskesmas',
              'lab',
              'clinic',
              'posyandu',
            ] as Facility['type'][]
          ).map((type) => (
            <li key={type} className="inline-flex items-center gap-1.5 text-[11px] text-obsidian-600">
              <span
                aria-hidden
                className={cn('size-2.5 rounded-full ring-2', TYPE_STYLE[type].fill, TYPE_STYLE[type].ring)}
              />
              {facilityTypeLabel[type]}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-obsidian-500">
          <Info aria-hidden className="mt-px size-3 shrink-0" />
          Plot skematis dari koordinat contoh, bukan peta untuk navigasi. Posisi relatifnya
          hanya perkiraan dan belum ada penyedia peta yang terhubung.
        </p>
      </div>
    </div>
  );
}
