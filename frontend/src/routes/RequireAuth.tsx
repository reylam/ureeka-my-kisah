import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentAccount } from '@/stores/authStore';
import { ROLE_HOME } from '@/lib/permissions';
import type { AccountRole } from '@/types/account';

/**
 * Route guards for the staff workspace. They decide what is drawn, not what is
 * allowed: every API call is authorised again on the server from the token.
 */

function SignInRedirect() {
  const location = useLocation();
  // Remember where they were heading so sign-in can return them there.
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  if (!account) return <SignInRedirect />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: AccountRole[]; children: ReactNode }) {
  const account = useCurrentAccount();
  if (!account) return <SignInRedirect />;
  // Put them somewhere useful rather than on a dead end.
  if (!roles.includes(account.role)) return <Navigate to={ROLE_HOME[account.role]} replace />;
  return <>{children}</>;
}

/** `/app`: each account's own home, so one link in the public header works for everybody. */
export function RoleHome() {
  const account = useCurrentAccount();
  if (!account) return <SignInRedirect />;
  return <Navigate to={ROLE_HOME[account.role]} replace />;
}
