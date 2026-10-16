import type { Facility, FacilityService, FacilityType, User } from '@/types/domain';
import type { Account } from '@/types/account';
import { api } from '@/lib/apiClient';
import { clearFacilityDirectory, setFacilityDirectory } from '@/data/facilities';
import { clearStaffDirectory, setStaffDirectory } from '@/data/users';

/**
 * Reference data: the staff directory and the facility directory.
 *
 * Both are small, change rarely, and are read by name lookups all over the
 * interface, so they are loaded once after sign-in into the registries in
 * `data/users.ts` and `data/facilities.ts`.
 */

/** A facility as the API returns it: the domain shape plus the publication flag. */
export interface FacilityDto extends Facility {
  published: boolean;
}

interface StaffDto {
  id: string;
  name: string;
  role: User['role'];
  canReview: boolean;
  facilityId: string;
  email: string | null;
  phone: string | null;
}

export function toFacility(dto: FacilityDto): FacilityDto {
  return {
    ...dto,
    type: dto.type as FacilityType,
    services: dto.services as FacilityService[],
  };
}

export async function fetchFacilities(): Promise<FacilityDto[]> {
  const rows = await api.get<FacilityDto[]>('/facilities');
  return rows.map(toFacility);
}

export async function fetchStaff(): Promise<User[]> {
  const rows = await api.get<StaffDto[]>('/staff');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    canReview: row.canReview,
    facilityId: row.facilityId,
    email: row.email ?? '',
    phone: row.phone,
  }));
}

/** Fill both registries for the signed-in account. Returns the facility list for stores that need it. */
export async function loadReferenceData(account: Account): Promise<FacilityDto[]> {
  const [staff, facilities] = await Promise.all([fetchStaff(), fetchFacilities()]);
  setStaffDirectory(staff);
  const own = account.staffUserId ? staff.find((member) => member.id === account.staffUserId) : null;
  setFacilityDirectory(facilities, own?.facilityId ?? null);
  return facilities;
}

export function clearReferenceData(): void {
  clearStaffDirectory();
  clearFacilityDirectory();
}
