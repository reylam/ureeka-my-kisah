import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { ROLE_LABEL } from '@/lib/permissions';
import { toast } from '@/stores/toastStore';

/** Who is signed in, and the way out. */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const signOut = useAuthStore((state) => state.signOut);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!account) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 items-center gap-2 rounded-full pr-1.5 pl-1 transition-colors hover:bg-obsidian-100"
      >
        <Avatar name={account.name} size="sm" />
        <span className="hidden max-w-40 truncate text-[13px] font-medium text-obsidian-900 sm:block">{account.name}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-obsidian-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-obsidian-200 bg-white shadow-overlay"
        >
          <div className="flex items-start gap-3 border-b border-obsidian-200 px-3.5 py-3">
            <Avatar name={account.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-obsidian-950">{account.name}</p>
              <p className="mt-0.5 text-xs text-obsidian-500">{ROLE_LABEL[account.role]}</p>
              <p className="mt-1 truncate text-xs text-obsidian-400">{account.email}</p>
            </div>
          </div>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
                navigate('/login', { replace: true });
                toast.info('Kamu sudah keluar.');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-obsidian-700 transition-colors hover:bg-obsidian-50"
            >
              <LogOut aria-hidden className="size-4 text-obsidian-400" />
              Keluar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
