import { create } from 'zustand';
import { TOUR_STEPS } from './tourSteps';

/**
 * Walkthrough state: whether it is running and which step it is on.
 *
 * "Seen" is remembered per browser only so the invitation does not come back
 * on every visit. Storage can be missing or blocked, so every access is
 * guarded and the tour works without it.
 */

const SEEN_KEY = 'parupintas.tour.seen';

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Only the invitation depends on this.
  }
}

interface TourState {
  active: boolean;
  index: number;
  start: () => void;
  stop: () => void;
  go: (index: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
  active: false,
  index: 0,
  start: () => {
    markSeen();
    set({ active: true, index: 0 });
  },
  stop: () => {
    markSeen();
    set({ active: false, index: 0 });
  },
  go: (index) => set({ index: Math.max(0, Math.min(index, TOUR_STEPS.length - 1)) }),
}));
