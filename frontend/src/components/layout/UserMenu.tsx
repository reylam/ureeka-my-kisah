import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore, useCurrentAccount, useCurrentUser } from '@/stores/authStore';
import { facilities } from '@/data/facilities';
import { ROLE_LABEL } from '@/lib/permissions';
import { toast } from '@/stores/toastStore';

/**
 * Profile menu: who is signed in, settings, and sign out.
 *
 * Keyed off the account, not the staff record. The previous version read
 * `useCurrentUser`, which is null for patients because they have no clinical
 * staff row, and then returned null for the whole menu. The effect was that
 * patients had no way to sign out at all. The account is what every signed-in
 * person has, so the menu hangs off that; the staff record only adds the
 * facility line when there is one.
 *
 * Settings is a professional and administrator screen. Patients manage their
 * own details from their profile page instead, so the menu links there for
 * them.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const account = useCurrentAccount();
  const staff = useCurrentUser();
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  if (!account) return null;

  const facility = staff ? facilities.find((f) => f.id === staff.facilityId) : null;
  const isPatient = account.role === 'patient';
  const displayName = account.onboarding.personal?.fullName || account.name;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 items-center gap-2 rounded-full pr-1.5 pl-1 transition-colors hover:bg-obsidian-100"
      >
        <Avatar name={displayName} size="sm" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-32 truncate text-[13px] leading-tight font-medium text-obsidian-900">
            {displayName}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-obsidian-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1.5 w-68 overflow-hidden rounded-xl border border-obsidian-200 bg-white shadow-overlay"
        >
          <div className="flex items-start gap-3 border-b border-obsidian-200 px-3.5 py-3">
            <Avatar name={displayName} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-obsidian-950">{displayName}</p>
              <p className="mt-0.5 text-xs text-obsidian-500">{ROLE_LABEL[account.role]}</p>
              <p className="mt-1 truncate text-xs text-obsidian-400">
                {facility ? facility.name : account.email}
              </p>
            </div>
          </div>

          <div className="p-1">
            <Link
              to={isPatient ? '/me/profile' : '/settings'}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-obsidian-700 transition-colors hover:bg-obsidian-50"
            >
              {isPatient ? (
                <UserCircle aria-hidden className="size-4 text-obsidian-400" />
              ) : (
                <Settings aria-hidden className="size-4 text-obsidian-400" />
              )}
              {isPatient ? 'My profile' : 'Account settings'}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                signOut();
                setOpen(false);
                navigate('/login', { replace: true });
                toast.info('Signed out.');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-obsidian-700 transition-colors hover:bg-obsidian-50"
            >
              <LogOut aria-hidden className="size-4 text-obsidian-400" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
