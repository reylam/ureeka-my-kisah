import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, useCurrentAccount } from '@/stores/authStore';
import { ErrorState } from '@/components/ui/EmptyState';
import { LineSkeleton } from '@/components/ui/Skeleton';
import { ROLE_HOME, can, type Permission } from '@/lib/permissions';
import type { AccountRole } from '@/types/account';

/**
 * Route guards.
 *
 * Three of them, each answering one question, so a route declares what it
 * needs rather than hand-rolling a redirect:
 *
 *   RequireAuth   is anyone signed in?
 *   RequireRole   is this one of the roles allowed here?
 *   RequirePermission  does this account hold a specific capability?
 *
 * All three are interface gates. They decide what is shown and they are not a
 * security boundary: the session is a Supabase token, and every API call and
 * every database row is authorised again on the server from that token alone
 * (Express middleware, then Row Level Security). Editing the role held in the
 * browser changes what is drawn, not what is allowed.
 *
 * `RequireAuth` also holds the page back until the workspace has loaded (the
 * staff and facility directories, and the records this role may see), so no
 * screen renders half-filled.
 */

function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-md px-6 py-24" role="status" aria-label="Memuat workspace kamu">
      <LineSkeleton lines={4} />
    </div>
  );
}

function WorkspaceError({ message }: { message: string | null }) {
  const loadWorkspace = useAuthStore((state) => state.loadWorkspace);
  const signOut = useAuthStore((state) => state.signOut);
  return (
    <div className="mx-auto max-w-md py-16">
      <ErrorState
        title="Workspace kamu gagal dimuat"
        description={message ?? undefined}
        onRetry={() => void loadWorkspace()}
      />
      <p className="text-center">
        <button
          type="button"
          className="text-[13px] text-obsidian-500 underline underline-offset-2 hover:text-obsidian-900"
          onClick={() => void signOut()}
        >
          Keluar
        </button>
      </p>
    </div>
  );
}

function SignInRedirect() {
  const location = useLocation();
  // Remember where they were heading so sign-in can return them there.
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const workspace = useAuthStore((state) => state.workspace);
  const workspaceError = useAuthStore((state) => state.workspaceError);

  if (!account) return <SignInRedirect />;

  if (account.status !== 'active') {
    return <Navigate to="/login" replace state={{ suspended: true }} />;
  }

  // Onboarding is optional: a new patient lands on their dashboard straight
  // after registering and can complete the profile later from the overview.

  if (workspace === 'error') return <WorkspaceError message={workspaceError} />;
  if (workspace !== 'ready') return <WorkspaceLoading />;

  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: AccountRole[];
  children: ReactNode;
}) {
  const account = useCurrentAccount();

  if (!account) return <SignInRedirect />;
  if (!roles.includes(account.role)) {
    // Send them to their own home rather than showing a dead end. Landing on
    // a "forbidden" page you can do nothing about is worse than being put
    // somewhere useful.
    return <Navigate to={ROLE_HOME[account.role]} replace />;
  }

  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const account = useCurrentAccount();

  if (!account) return <SignInRedirect />;
  if (!can(account, permission)) return <Navigate to={ROLE_HOME[account.role]} replace />;

  return <>{children}</>;
}

/**
 * Entry point for `/app`: sends each account to the home its role actually
 * has, so one link in the public header works for everybody.
 */
export function RoleHome() {
  const account = useCurrentAccount();
  if (!account) return <SignInRedirect />;
  return <Navigate to={ROLE_HOME[account.role]} replace />;
}
