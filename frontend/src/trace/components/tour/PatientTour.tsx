import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardList, Compass, Loader2, Upload, X } from 'lucide-react';
import { TraceButton } from '@/trace/components/ui/TraceButton';
import { usePrefersReducedMotion } from '@/trace/hooks/usePrefersReducedMotion';
import { TOUR_STEPS } from './tourSteps';
import { tourSeen, useTourStore } from './tourStore';
import { cn } from '@/utils/cn';

/**
 * The patient walkthrough overlay.
 *
 * One card, one spotlight. The card carries the step's words and the only
 * controls that matter while the tour runs; the rest of the page is dimmed and
 * does not take clicks, so "Lanjut" is always the next thing to press. The
 * tour drives the page itself: it changes route, scrolls the target into view,
 * and presses the demo's buttons when a step says so.
 *
 * Targets are looked up every animation frame rather than once, because the
 * pages are code-split and the demo's panels mount only after a sample loads
 * or the model finishes. The same loop keeps the spotlight on its element
 * while the page scrolls or reflows.
 */

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOT_PAD = 8;
const EDGE = 16;
const GAP = 14;
const HEADER_OFFSET = 96;
const DEFAULT_WAIT = 3_000;

const find = (name: string) => document.querySelector<HTMLElement>(`[data-tour="${name}"]`);

const boxOf = (element: HTMLElement): Box | null => {
  const r = element.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

export function PatientTour() {
  const active = useTourStore((state) => state.active);
  const index = useTourStore((state) => state.index);
  const go = useTourStore((state) => state.go);
  const stop = useTourStore((state) => state.stop);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduced = usePrefersReducedMotion();

  const step = TOUR_STEPS[index]!;
  const total = TOUR_STEPS.length;
  const onRoute = pathname === step.route;

  const [spot, setSpot] = useState<Box | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [cardHeight, setCardHeight] = useState(260);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // Each step lives on one route; go there first.
  useEffect(() => {
    if (active && !onRoute) navigate(step.route);
  }, [active, onRoute, step.route, navigate]);

  // Find the target, wait for it if the step says so, and keep the spotlight on it.
  useEffect(() => {
    if (!active) return;
    setSpot(null);
    setWaiting(Boolean(step.target));
    if (!step.target || !onRoute) return;

    const target = step.target;
    const started = performance.now();
    const limit = step.wait ?? DEFAULT_WAIT;
    let scrolledTo: HTMLElement | null = null;
    let frame = 0;

    const tick = () => {
      let element = find(target);
      let stillWaiting = false;

      if (!element) {
        const failed = document.querySelector('[data-tour-failed]') !== null;
        stillWaiting = !failed && performance.now() - started < limit;
        element = stillWaiting && step.waitSpot ? find(step.waitSpot) : null;
      }

      // A target that exists but is hidden (desktop menu on a phone) gets a
      // centred card, not a wait.
      const box = element ? boxOf(element) : null;

      if (element && box && element !== scrolledTo) {
        scrolledTo = element;
        const inHeader = element.closest('header') !== null;
        if (!inHeader) {
          window.scrollTo({
            top: Math.max(0, box.top + window.scrollY - HEADER_OFFSET),
            behavior: reduced ? 'auto' : 'smooth',
          });
        }
      }

      setWaiting(stillWaiting);
      setSpot((previous) => (sameBox(previous, box) ? previous : box));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, index, onRoute, step, reduced]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active]);

  useLayoutEffect(() => {
    const height = cardRef.current?.offsetHeight;
    if (height && Math.abs(height - cardHeight) > 1) setCardHeight(height);
  });

  // Focus the card on every step, so a screen reader reads the new words.
  useEffect(() => {
    if (active) cardRef.current?.focus({ preventScroll: true });
  }, [active, index]);

  const next = useCallback(() => {
    if (waiting) return;
    if (step.clickOnNext) find(step.clickOnNext)?.click();
    go(index + 1);
  }, [waiting, step, go, index]);

  const back = useCallback(() => go(index - 1), [go, index]);

  const uploadOwn = () => {
    stop();
    find('demo-upload')?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  };

  const toRequest = () => {
    stop();
    navigate('/daftar');
  };

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
      else if (event.key === 'ArrowRight' && !step.final) next();
      else if (event.key === 'ArrowLeft' && index > 0) back();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, step.final, index, next, back, stop]);

  if (!active) return null;

  /* ── Card placement ─────────────────────────────────────────────────── */

  const narrow = viewport.w < 640;
  const width = Math.min(380, viewport.w - EDGE * 2);
  let cardStyle: React.CSSProperties;

  if (narrow) {
    // Phones: a sheet docked to whichever edge the spotlight is not near.
    const spotLow = spot !== null && spot.top + spot.height / 2 > viewport.h / 2;
    cardStyle = spotLow
      ? { left: EDGE, right: EDGE, top: EDGE + 64 }
      : { left: EDGE, right: EDGE, bottom: EDGE };
  } else if (spot) {
    const below = spot.top + spot.height + SPOT_PAD + GAP;
    const above = spot.top - SPOT_PAD - GAP - cardHeight;
    const top =
      below + cardHeight <= viewport.h - EDGE
        ? below
        : above >= EDGE
          ? above
          : viewport.h - EDGE - cardHeight;
    const left = Math.min(
      Math.max(spot.left + spot.width / 2 - width / 2, EDGE),
      viewport.w - EDGE - width,
    );
    cardStyle = { top, left, width };
  } else {
    cardStyle = {
      top: Math.max(EDGE, (viewport.h - cardHeight) / 2),
      left: (viewport.w - width) / 2,
      width,
    };
  }

  const progress = ((index + 1) / total) * 100;

  return (
    <div className="fixed inset-0 z-[60]" aria-hidden={false}>
      {/* Swallows clicks on the page while the tour runs. */}
      <div className="absolute inset-0" onClick={(event) => event.stopPropagation()} />

      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-trace-accent transition-all duration-300 ease-out"
          style={{
            top: spot.top - SPOT_PAD,
            left: spot.left - SPOT_PAD,
            width: spot.width + SPOT_PAD * 2,
            height: spot.height + SPOT_PAD * 2,
            boxShadow: '0 0 0 9999px rgb(10 12 16 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgb(10_12_16/0.55)]" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={cardStyle}
        className="absolute rounded-2xl border border-trace-line bg-trace-card p-5 shadow-[0_18px_48px_-12px_rgb(10_12_16/0.45)] transition-[top,left] duration-300 ease-out focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 trace-label text-trace-dim">
            <Compass aria-hidden className="size-3.5 text-trace-accent" />
            Langkah {index + 1} dari {total}
          </p>
          <button
            type="button"
            onClick={stop}
            className="-mr-1.5 grid size-8 place-items-center rounded-full text-trace-dim transition-colors hover:bg-trace-raised hover:text-trace-text"
          >
            <span className="sr-only">Tutup panduan</span>
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-trace-raised">
          <div
            className="h-full rounded-full bg-trace-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <h2 id={titleId} className="mt-4 text-[17px] leading-snug font-semibold tracking-[-0.01em]">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-2 text-[13.5px] leading-6 text-trace-muted">
          {step.body}
        </p>

        {waiting && step.waitingLabel ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-[12.5px] text-trace-accent">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            {step.waitingLabel}
          </p>
        ) : null}

        {step.final ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <TraceButton size="sm" onClick={uploadOwn}>
              <Upload aria-hidden className="size-3.5" />
              Upload X-ray saya
            </TraceButton>
            <TraceButton size="sm" variant="secondary" onClick={toRequest}>
              <ClipboardList aria-hidden className="size-3.5" />
              Daftar periksa
            </TraceButton>
            <TraceButton size="sm" variant="ghost" onClick={stop}>
              Selesai
            </TraceButton>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between gap-2">
            <TraceButton
              size="sm"
              variant="ghost"
              onClick={back}
              className={cn(index === 0 && 'invisible')}
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              Kembali
            </TraceButton>
            <TraceButton size="sm" onClick={next} disabled={waiting}>
              {step.nextLabel ?? (index === 0 ? 'Mulai' : 'Lanjut')}
              <ArrowRight aria-hidden className="size-3.5" />
            </TraceButton>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * First-visit invitation, bottom corner. It goes away for good once the tour
 * has been started or this card dismissed.
 */
export function TourInvite() {
  const active = useTourStore((state) => state.active);
  const start = useTourStore((state) => state.start);
  const stop = useTourStore((state) => state.stop);
  const [open, setOpen] = useState(() => !tourSeen());

  if (!open || active) return null;

  return (
    <aside
      aria-label="Panduan pasien"
      className="trace-rise fixed right-4 bottom-4 left-4 z-50 rounded-2xl border border-trace-line bg-trace-card p-4 shadow-[0_18px_48px_-12px_rgb(10_12_16/0.35)] sm:left-auto sm:w-[340px]"
    >
      <p className="flex items-center gap-2 text-[14px] font-semibold text-trace-text">
        <Compass aria-hidden className="size-4 text-trace-accent" />
        Baru pertama kali di sini?
      </p>
      <p className="mt-1.5 text-[13px] leading-6 text-trace-muted">
        Ikuti panduan pasien, sekitar satu menit. Tinggal tekan Lanjut sampai mencoba demo chest X-ray.
        Tidak perlu akun.
      </p>
      <div className="mt-3.5 flex gap-2">
        <TraceButton
          size="sm"
          onClick={() => {
            setOpen(false);
            start();
          }}
        >
          Mulai panduan
        </TraceButton>
        <TraceButton
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            stop();
          }}
        >
          Nanti saja
        </TraceButton>
      </div>
    </aside>
  );
}
