import { useEffect, useState } from 'react';
import { onSessionReset } from '@/lib/sessionReset';
import { listStaff } from '@/services/recordsApi';

/**
 * Names of the clinic's staff, for "recorded by". Loaded once per session and
 * shared, since the same few people appear on every row.
 */

let cache: Promise<Map<string, string>> | null = null;

onSessionReset(() => {
  cache = null;
});

function load(): Promise<Map<string, string>> {
  if (!cache) {
    cache = listStaff()
      .then((staff) => new Map(staff.map((member) => [member.id, member.name])))
      .catch(() => {
        // Not worth an error state: the page falls back to "petugas".
        cache = null;
        return new Map<string, string>();
      });
  }
  return cache;
}

export function useStaffNames(): (id: string | null | undefined) => string {
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    void load().then((loaded) => {
      if (active) setNames(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return (id) => (id ? (names.get(id) ?? 'Petugas') : 'Petugas');
}
