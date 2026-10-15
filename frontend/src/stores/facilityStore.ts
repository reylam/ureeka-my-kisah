import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Facility, FacilityService, FacilityType } from '@/types/domain';
import { facilities as seedFacilities } from '@/data/facilities';
import { createId } from '@/utils/id';

/**
 * The facility directory, made editable.
 *
 * `data/facilities.ts` is a static array that the public directory and the
 * referral picker both read. Administrators need to add and correct entries,
 * so the array becomes the seed for this store and every reader moves onto it.
 *
 * `published` decides whether an entry appears on the public pages. Unpublished
 * is not deleted: an entry being checked should disappear from the directory
 * without losing the work, and a referral that already points at it must keep
 * resolving.
 */

export interface FacilityDraft {
  name: string;
  type: FacilityType;
  province: string;
  region: string;
  address: string;
  phone: string;
  operatingHours: string;
  services: FacilityService[];
  tbProgrammeContact: string | null;
}

export interface ManagedFacility extends Facility {
  published: boolean;
}

export interface FacilityState {
  facilities: ManagedFacility[];
  create: (draft: FacilityDraft) => ManagedFacility;
  update: (id: string, draft: FacilityDraft) => void;
  setPublished: (id: string, published: boolean) => void;
  remove: (id: string) => void;
}

const asManaged = (facility: Facility): ManagedFacility => ({ ...facility, published: true });

function fromDraft(draft: FacilityDraft, base?: ManagedFacility): ManagedFacility {
  return {
    id: base?.id ?? createId('fac'),
    name: draft.name.trim(),
    type: draft.type,
    region: draft.region.trim(),
    province: draft.province.trim(),
    address: draft.address.trim(),
    phone: draft.phone.trim(),
    // Coordinates and travel estimates are not asked for in the form: typing a
    // latitude by hand is how a directory ends up pointing at the sea. New
    // entries inherit the operating facility's position until a real lookup
    // exists, and the map is honest about which pins are estimated.
    coordinates: base?.coordinates ?? { lat: -8.4895, lng: 119.8877 },
    services: draft.services,
    distanceKm: base?.distanceKm ?? 0,
    travelTimeMinutes: base?.travelTimeMinutes ?? 0,
    infoStatus: 'needs-review',
    infoUpdatedAt: new Date().toISOString().slice(0, 10),
    operatingHours: draft.operatingHours.trim(),
    tbProgrammeContact: draft.tbProgrammeContact?.trim() || null,
    published: base?.published ?? false,
  };
}

export const useFacilityStore = create<FacilityState>()(
  persist(
    (set) => ({
      facilities: seedFacilities.map(asManaged),

      create: (draft) => {
        const facility = fromDraft(draft);
        set((state) => ({ facilities: [facility, ...state.facilities] }));
        return facility;
      },

      update: (id, draft) =>
        set((state) => ({
          facilities: state.facilities.map((facility) =>
            facility.id === id ? fromDraft(draft, facility) : facility,
          ),
        })),

      setPublished: (id, published) =>
        set((state) => ({
          facilities: state.facilities.map((facility) =>
            facility.id === id ? { ...facility, published } : facility,
          ),
        })),

      remove: (id) =>
        set((state) => ({
          facilities: state.facilities.filter((facility) => facility.id !== id),
        })),
    }),
    {
      name: 'pulmo.facilities.v1',
      /**
       * Seeded entries come from code on every load, so correcting one in
       * `data/facilities.ts` reaches people who already have storage. Only the
       * published flag is kept from their copy, because that is a decision an
       * administrator made rather than data we ship.
       */
      merge: (persisted, current) => {
        const saved = (persisted as Partial<FacilityState> | undefined)?.facilities ?? [];
        const seededIds = new Set(seedFacilities.map((facility) => facility.id));
        return {
          ...current,
          facilities: [
            ...saved.filter((facility) => !seededIds.has(facility.id)),
            ...seedFacilities.map((seed) => {
              const existing = saved.find((facility) => facility.id === seed.id);
              return { ...asManaged(seed), published: existing?.published ?? true };
            }),
          ],
        } as FacilityState;
      },
    },
  ),
);

/** Only published entries, for the public directory and the patient view. */
export function usePublishedFacilities(): ManagedFacility[] {
  return useFacilityStore((state) => state.facilities.filter((facility) => facility.published));
}
