import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Route guard for the simulated session.
 *
 * To be explicit: this is a UX gate, not a security boundary. It checks a flag
 * in localStorage. There is no server, no token and nothing to verify. A
 * determined visitor can set the flag themselves. It exists so the prototype
 * demonstrates a sign-in flow, nothing more.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const userId = useAuthStore((state) => state.userId);
  const location = useLocation();

  if (!userId) {
    // Remember where they were heading so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
