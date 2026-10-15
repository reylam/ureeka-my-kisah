import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentAccount } from '@/stores/authStore';
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
 * security boundary: the session and the account directory both live in the
 * visitor's own browser. The same checks have to exist on the server before
 * any of this touches real records. `docs/api-contract.md` lists which
 * endpoint owns which one.
 */

function SignInRedirect() {
  const location = useLocation();
  // Remember where they were heading so sign-in can return them there.
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();

  if (!account) return <SignInRedirect />;

  if (account.status !== 'active') {
    return <Navigate to="/login" replace state={{ suspended: true }} />;
  }

  // A patient who has not finished onboarding is sent back to it, wherever in
  // the application they were trying to go.
  if (account.role === 'patient' && !account.onboarding.completedAt) {
    return <Navigate to="/onboarding" replace />;
  }

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
  if (account.role === 'patient' && !account.onboarding.completedAt) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to={ROLE_HOME[account.role]} replace />;
}
