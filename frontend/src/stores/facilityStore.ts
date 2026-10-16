import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Facility, FacilityService, FacilityType } from '@/types/domain';
import { api } from '@/lib/apiClient';
import { onSessionReset } from '@/lib/sessionReset';
import { setFacilityDirectory, OPERATING_FACILITY_ID } from '@/data/facilities';
import { toFacility, type FacilityDto } from '@/services/referenceData';

/**
 * The facility directory, as administrators manage it.
 *
 * The list comes from `GET /facilities` (an administrator receives the
 * unpublished entries too) and every change goes through the API, which owns
 * the rules: new entries are created unpublished, an edit puts the entry back
 * to "needs review", and each action is audited server-side.
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
  replaceAll: (list: FacilityDto[]) => void;
  create: (draft: FacilityDraft) => Promise<ManagedFacility>;
  update: (id: string, draft: FacilityDraft) => Promise<void>;
  setPublished: (id: string, published: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

export const useFacilityStore = create<FacilityState>()((set, get) => {
  /** Keep the name-lookup registry in step with what the server last said. */
  const publish = (list: ManagedFacility[]) => {
    set({ facilities: list });
    setFacilityDirectory(list, OPERATING_FACILITY_ID || null);
  };

  const replaceOne = (updated: FacilityDto) =>
    publish(get().facilities.map((f) => (f.id === updated.id ? toFacility(updated) : f)));

  return {
    facilities: [],

    replaceAll: (list) => set({ facilities: list.map(toFacility) }),

    create: async (draft) => {
      const created = toFacility(await api.post<FacilityDto>('/facilities', draft));
      publish([created, ...get().facilities]);
      return created;
    },

    update: async (id, draft) => {
      replaceOne(await api.patch<FacilityDto>(`/facilities/${id}`, draft));
    },

    setPublished: async (id, published) => {
      replaceOne(await api.patch<FacilityDto>(`/facilities/${id}/published`, { published }));
    },

    remove: async (id) => {
      await api.delete(`/facilities/${id}`);
      publish(get().facilities.filter((f) => f.id !== id));
    },

    reset: () => set({ facilities: [] }),
  };
});

onSessionReset(() => useFacilityStore.getState().reset());

/** Only published entries, for the public directory and the patient view. */
export function usePublishedFacilities(): ManagedFacility[] {
  return useFacilityStore(
    useShallow((state) => state.facilities.filter((facility) => facility.published)),
  );
}
