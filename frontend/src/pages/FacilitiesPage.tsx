import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Clock,
  List,
  Map as MapIcon,
  Phone,
  Send,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/forms/Inputs';
import { FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { EmptyState, NoMatchesState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { FacilityInfoBadge } from '@/components/ui/StatusBadge';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { FacilityMap } from '@/components/facilities/FacilityMap';
import { ReferralFormDialog } from '@/components/referrals/ReferralFormDialog';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { useTableControls } from '@/hooks/useTableControls';
import { mockApi } from '@/services/mockApi';
import { facilities as staticFacilities, OPERATING_FACILITY_ID } from '@/data/facilities';
import { DISTRICTS } from '@/data/geography';
import { facilityServiceLabel, facilityTypeLabel } from '@/utils/labels';
import { formatDate } from '@/utils/date';
import { formatDistance, formatTravelTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { Facility, FacilityService, FacilityType } from '@/types/domain';

/**
 * Facility directory.
 *
 * Two things a health worker needs from this screen: who can run the test the
 * patient needs, and how far away they are. So the cards lead with services and
 * travel estimates, and every entry carries how stale its information is, since
 * an out-of-date directory is how patients get sent to the wrong place.
 */

type FilterKey = 'region' | 'type' | 'service';
type ViewMode = 'list' | 'map';

const TYPES: FacilityType[] = [
  'referral-hospital',
  'district-hospital',
  'puskesmas',
  'clinic',
  'lab',
  'posyandu',
];

const SERVICES: FacilityService[] = [
  'cxr',
  'sputum-microscopy',
  'tcm-genexpert',
  'tb-treatment',
  'mdr-tb-treatment',
  'pediatric-tb',
  'inpatient',
];

export function FacilitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>('list');
  const [referralFor, setReferralFor] = useState<Facility | null>(null);

  const { data: facilities, loading } = useStoreQuery<Facility[]>(
    () => mockApi.getFacilities(),
    () => staticFacilities,
  );

  const all = facilities ?? [];
  const focusId = searchParams.get('focus');
  const focused = all.find((facility) => facility.id === focusId) ?? null;

  useEffect(() => {
    if (focusId && !loading && !focused) {
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [focusId, focused, loading, searchParams, setSearchParams]);

  const setFocus = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('focus', id);
    else next.delete('focus');
    setSearchParams(next, { replace: !id });
  };

  const controls = useTableControls<Facility, FilterKey>({
    rows: all,
    initialSort: { columnId: 'distance', direction: 'asc' },
    initialPageSize: 50,
    search: (facility, term) =>
      facility.name.toLowerCase().includes(term) ||
      facility.region.toLowerCase().includes(term) ||
      facility.address.toLowerCase().includes(term) ||
      facility.services.some((service) =>
        facilityServiceLabel[service].toLowerCase().includes(term),
      ),
    filters: {
      region: (facility, value) => facility.region === value,
      type: (facility, value) => facility.type === value,
      service: (facility, value) => facility.services.includes(value as FacilityService),
    },
    comparators: {
      distance: (a, b) => a.distanceKm - b.distanceKm,
      name: (a, b) => a.name.localeCompare(b.name),
    },
  });

  const sorted = useMemo(
    () => [...controls.filtered].sort((a, b) => a.distanceKm - b.distanceKm),
    [controls.filtered],
  );

  const tbCapable = all.filter(
    (facility) =>
      facility.services.includes('tcm-genexpert') ||
      facility.services.includes('sputum-microscopy'),
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Healthcare facilities"
        description="Sample directory of facilities around this district, with the services each one offers."
        meta={
          <>
            <HeaderMeta label="Facilities" value={all.length} />
            <HeaderMeta label="Can test for TB" value={tbCapable} />
            <HeaderMeta
              label="Needing review"
              value={all.filter((f) => f.infoStatus !== 'verified-sample').length}
            />
          </>
        }
      />

      <Notice tone="demo">
        Every facility here is invented for the prototype. Addresses, phone numbers, opening hours,
        services and travel estimates are illustrative sample values and must not be treated as
        verified real-world information.
      </Notice>

      <Card className="overflow-hidden">
        <Toolbar
          activeFilterCount={controls.activeFilterCount}
          onClearFilters={controls.clearAll}
          search={
            <SearchInput
              label="Search facilities by name, region, address or service"
              placeholder="Name, region or service"
              value={controls.term}
              onChange={controls.setTerm}
            />
          }
          filters={
            <>
              <FilterSelect
                label="Region"
                allLabel="All regions"
                value={controls.filterValues.region}
                options={DISTRICTS.map((district) => ({
                  value: district,
                  label: district,
                  count: all.filter((f) => f.region === district).length,
                }))}
                onChange={(value) => controls.setFilter('region', value)}
              />
              <FilterSelect
                label="Type"
                allLabel="All types"
                value={controls.filterValues.type as FacilityType | 'all'}
                options={TYPES.map((type) => ({
                  value: type,
                  label: facilityTypeLabel[type],
                  count: all.filter((f) => f.type === type).length,
                }))}
                onChange={(value) => controls.setFilter('type', value)}
              />
              <FilterSelect
                label="Service"
                allLabel="Any service"
                value={controls.filterValues.service as FacilityService | 'all'}
                options={SERVICES.map((service) => ({
                  value: service,
                  label: facilityServiceLabel[service],
                  count: all.filter((f) => f.services.includes(service)).length,
                }))}
                onChange={(value) => controls.setFilter('service', value)}
              />
            </>
          }
          trailing={
            <>
              <ResultCount
                shown={controls.filtered.length}
                total={all.length}
                noun="facilities"
              />
              <div
                role="group"
                aria-label="View mode"
                className="flex items-center rounded-md bg-obsidian-100 p-0.5"
              >
                <ViewButton
                  active={view === 'list'}
                  onClick={() => setView('list')}
                  icon={<List className="size-3.5" />}
                  label="List"
                />
                <ViewButton
                  active={view === 'map'}
                  onClick={() => setView('map')}
                  icon={<MapIcon className="size-3.5" />}
                  label="Map"
                />
              </div>
            </>
          }
        />

        {loading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No facilities in the directory"
            description="The sample directory could not be loaded."
          />
        ) : controls.filtered.length === 0 ? (
          <NoMatchesState entity="facilities" onClear={controls.clearAll} />
        ) : view === 'map' ? (
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <FacilityMap
              facilities={sorted}
              selectedId={focusId}
              onSelect={(id) => setFocus(id)}
            />
            <div>
              <h2 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                Nearest first
              </h2>
              <ul className="mt-2 divide-y divide-obsidian-100 overflow-hidden rounded-md border border-obsidian-200">
                {sorted.map((facility) => (
                  <li key={facility.id}>
                    <button
                      type="button"
                      onClick={() => setFocus(facility.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                        facility.id === focusId ? 'bg-ct-50' : 'hover:bg-obsidian-50',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-obsidian-900">
                          {facility.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-obsidian-500">
                          {facilityTypeLabel[facility.type]} · {facility.region}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-obsidian-500 tabular">
                        {facility.id === OPERATING_FACILITY_ID
                          ? 'Here'
                          : formatDistance(facility.distanceKm)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((facility) => (
              <li key={facility.id}>
                <FacilityCard
                  facility={facility}
                  onOpen={() => setFocus(facility.id)}
                  onRefer={() => setReferralFor(facility)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog
        open={Boolean(focused)}
        onClose={() => setFocus(null)}
        size="lg"
        title={focused?.name ?? 'Facility'}
        description={
          focused
            ? `${facilityTypeLabel[focused.type]} · ${focused.region}, ${focused.province}`
            : undefined
        }
        footer={
          focused ? (
            <>
              <Button variant="ghost" onClick={() => setFocus(null)}>
                Close
              </Button>
              {focused.id !== OPERATING_FACILITY_ID ? (
                <Button
                  variant="primary"
                  leadingIcon={<Send className="size-4" />}
                  onClick={() => {
                    setReferralFor(focused);
                    setFocus(null);
                  }}
                >
                  Refer a patient here
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {focused ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" icon={<Building2 />}>
                {facilityTypeLabel[focused.type]}
              </Badge>
              <FacilityInfoBadge status={focused.infoStatus} />
              {focused.id === OPERATING_FACILITY_ID ? (
                <Badge tone="info" icon={<UserRound />}>
                  Your facility
                </Badge>
              ) : null}
            </div>

            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Address">{focused.address}</DetailRow>
              <DetailRow label="Phone">
                <a
                  href={`tel:${focused.phone.replace(/[^\d+]/g, '')}`}
                  className="text-ct-700 underline decoration-ct-300 underline-offset-2"
                >
                  {focused.phone}
                </a>
              </DetailRow>
              <DetailRow label="Opening hours">{focused.operatingHours}</DetailRow>
              <DetailRow label="Travel from here">
                {focused.id === OPERATING_FACILITY_ID ? (
                  'This is your facility'
                ) : (
                  <span className="tabular">
                    {formatDistance(focused.distanceKm)} ·{' '}
                    {formatTravelTime(focused.travelTimeMinutes)}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="TB programme contact">
                {focused.tbProgrammeContact ?? 'No named contact on file'}
              </DetailRow>
              <DetailRow label="Entry last checked">
                {formatDate(focused.infoUpdatedAt)}
              </DetailRow>
            </dl>

            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                Services listed
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {focused.services.map((service) => (
                  <li key={service}>
                    <Badge tone="neutral" size="sm" icon={<Stethoscope />}>
                      {facilityServiceLabel[service]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            {focused.infoStatus !== 'verified-sample' ? (
              <Notice tone="attention" title="This entry may be out of date">
                It was last checked on {formatDate(focused.infoUpdatedAt)}. Confirm services and
                opening hours by phone before sending a patient on a long journey.
              </Notice>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      {referralFor ? (
        <ReferralFormDialog
          open
          onClose={() => setReferralFor(null)}
          defaultFacilityId={referralFor.id}
        />
      ) : null}
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────────── */

function FacilityCard({
  facility,
  onOpen,
  onRefer,
}: {
  facility: Facility;
  onOpen: () => void;
  onRefer: () => void;
}) {
  const isOperating = facility.id === OPERATING_FACILITY_ID;

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-card border bg-white p-3.5 transition-colors',
        isOperating ? 'border-ct-300 bg-ct-50/40' : 'border-obsidian-200 hover:border-obsidian-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-obsidian-950">{facility.name}</h3>
          <p className="mt-0.5 text-xs text-obsidian-500">
            {facilityTypeLabel[facility.type]} · {facility.region}
          </p>
        </div>
        {isOperating ? (
          <Badge tone="info" size="sm" icon={<UserRound />}>
            Here
          </Badge>
        ) : (
          <span className="shrink-0 text-right text-xs font-medium text-obsidian-700 tabular">
            {formatDistance(facility.distanceKm)}
            <span className="mt-0.5 block font-normal text-obsidian-400">
              {formatTravelTime(facility.travelTimeMinutes)}
            </span>
          </span>
        )}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-obsidian-600">{facility.address}</p>

      <ul className="mt-2.5 flex flex-wrap gap-1">
        {facility.services.slice(0, 4).map((service) => (
          <li
            key={service}
            className="rounded bg-obsidian-100 px-1.5 py-0.5 text-[11px] text-obsidian-600"
          >
            {facilityServiceLabel[service]}
          </li>
        ))}
        {facility.services.length > 4 ? (
          <li className="rounded px-1.5 py-0.5 text-[11px] text-obsidian-400">
            +{facility.services.length - 4} more
          </li>
        ) : null}
      </ul>

      <dl className="mt-3 space-y-1 text-xs text-obsidian-500">
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Phone</dt>
          <Phone aria-hidden className="mt-0.5 size-3 shrink-0" />
          <dd>{facility.phone}</dd>
        </div>
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Opening hours</dt>
          <Clock aria-hidden className="mt-0.5 size-3 shrink-0" />
          <dd className="leading-relaxed">{facility.operatingHours}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-obsidian-100 pt-2.5">
        <FacilityInfoBadge status={facility.infoStatus} size="sm" />
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onOpen}>
            Details
          </Button>
          {!isOperating ? (
            <Button size="sm" variant="outline" onClick={onRefer}>
              Refer
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors',
        active ? 'bg-white text-obsidian-950 shadow-card' : 'text-obsidian-500 hover:text-obsidian-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
