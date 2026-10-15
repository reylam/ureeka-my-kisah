/**
 * Small artificial latency for the mock service layer.
 *
 * This exists so loading skeletons and disabled-button states are actually
 * demonstrable. It is kept short enough not to be annoying, and is skipped
 * entirely when the user prefers reduced motion (a reasonable proxy for "stop
 * adding theatre to my interface").
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function delay(ms: number): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Jittered delay, so repeated calls do not resolve in lockstep. */
export function jitteredDelay(base: number, spread = 120): Promise<void> {
  return delay(base + Math.random() * spread);
}
