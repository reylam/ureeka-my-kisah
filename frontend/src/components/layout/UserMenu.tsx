import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, FlaskConical, LogOut, Settings, UserCog } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import { userRoleLabel } from '@/utils/labels';
import { toast } from '@/stores/toastStore';

/**
 * Profile menu.
 *
 * Includes a user switcher: in a real deployment this would be impossible, but
 * in a demo it is the quickest way to show that review permissions differ by
 * role. It is labelled as a demo control so the distinction is clear.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const user = useCurrentUser();
  const signOut = useAuthStore((state) => state.signOut);
  const switchUser = useAuthStore((state) => state.switchUser);

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

  if (!user) return null;

  const facility = facilities.find((f) => f.id === user.facilityId);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 items-center gap-2 rounded-md pr-1.5 pl-1 transition-colors hover:bg-obsidian-100"
      >
        <Avatar name={user.name} size="sm" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-32 truncate text-[13px] leading-tight font-medium text-obsidian-900">
            {user.name}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-obsidian-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-lg border border-obsidian-200 bg-white shadow-overlay"
        >
          <div className="flex items-start gap-3 border-b border-obsidian-200 px-3.5 py-3">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-obsidian-950">{user.name}</p>
              <p className="mt-0.5 text-xs text-obsidian-500">{userRoleLabel[user.role]}</p>
              <p className="mt-1 truncate text-xs text-obsidian-400">{facility?.name}</p>
            </div>
          </div>

          <div className="border-b border-obsidian-200 p-1">
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-obsidian-700 transition-colors hover:bg-obsidian-50"
            >
              <Settings aria-hidden className="size-4 text-obsidian-400" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                signOut();
                setOpen(false);
                navigate('/login', { replace: true });
                toast.info('Signed out of the demo session.');
              }}
              className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-[13px] text-obsidian-700 transition-colors hover:bg-obsidian-50"
            >
              <LogOut aria-hidden className="size-4 text-obsidian-400" />
              Sign out
            </button>
          </div>

          <div className="bg-obsidian-50/70 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
              <FlaskConical aria-hidden className="size-3" />
              Demo control
            </p>
            <label className="mt-2 block">
              <span className="flex items-center gap-1.5 text-xs text-obsidian-600">
                <UserCog aria-hidden className="size-3.5" />
                Act as
              </span>
              <select
                value={user.id}
                onChange={(event) => {
                  switchUser(event.target.value);
                  setOpen(false);
                  const next = users.find((u) => u.id === event.target.value);
                  toast.info(
                    `Now acting as ${next?.name ?? 'another user'}.`,
                    next?.canReview
                      ? 'This role can sign off clinical reviews.'
                      : 'This role cannot sign off clinical reviews.',
                  );
                }}
                className="mt-1.5 h-8 w-full cursor-pointer rounded-md border border-obsidian-200 bg-white px-2 text-[13px] text-obsidian-900"
              >
                {users.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({userRoleLabel[option.role]})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[11px] leading-relaxed text-obsidian-500">
              Sign-in is simulated locally. No authentication server is involved.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
