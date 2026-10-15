/**
 * Connection state for the offline-first behaviour.
 *
 * Two separate ideas are tracked, because conflating them is how offline demos
 * end up lying to people:
 *
 * - `online`: what the browser actually reports (`navigator.onLine` plus the
 *               online/offline events). Real signal.
 * - `simulatedOffline`: a deliberate choice to work offline, surfaced as
 *               "Work offline". Useful on a connection that keeps dropping,
 *               where repeated failed sync attempts cost more than waiting.
 *
 * `isConnected` is the value features should branch on.
 */

import { create } from 'zustand';

interface ConnectionState {
  online: boolean;
  simulatedOffline: boolean;
  /** Timestamp of the last transition, for the status tooltip. */
  changedAt: string;
  setOnline: (online: boolean) => void;
  toggleSimulatedOffline: () => void;
  setSimulatedOffline: (value: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  simulatedOffline: false,
  changedAt: new Date().toISOString(),

  setOnline: (online) =>
    set((state) =>
      state.online === online ? state : { online, changedAt: new Date().toISOString() },
    ),

  toggleSimulatedOffline: () =>
    set((state) => ({
      simulatedOffline: !state.simulatedOffline,
      changedAt: new Date().toISOString(),
    })),

  setSimulatedOffline: (value) =>
    set({ simulatedOffline: value, changedAt: new Date().toISOString() }),
}));

/** The effective connection state: what the app should actually act on. */
export function useIsConnected(): boolean {
  return useConnectionStore((state) => state.online && !state.simulatedOffline);
}

/** Non-reactive read for use inside event handlers and store actions. */
export function isConnectedNow(): boolean {
  const { online, simulatedOffline } = useConnectionStore.getState();
  return online && !simulatedOffline;
}

/** Wire up browser connectivity events. Called once from the app shell. */
export function initConnectionListeners(): () => void {
  const update = () => useConnectionStore.getState().setOnline(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
