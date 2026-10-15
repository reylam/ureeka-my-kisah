import { cn } from '@/utils/cn';

/**
 * The project mascot: a friendly pair of lungs.
 *
 * Used sparingly and only where a softer tone genuinely helps: the demo while
 * it is waiting for a file, the question list, and the closing invitation. It
 * stays off the hero, where the radiograph figure is the stronger image, and
 * off anything that reports a result, where a cartoon face next to a screening
 * output would be exactly the wrong note.
 *
 * `alt=""` with `aria-hidden` on purpose: it is decoration, and announcing
 * "smiling lungs illustration" to a screen reader adds nothing to the page.
 *
 * A soft radial glow sits behind it so the pale artwork settles onto the
 * near-black page instead of floating on it as a cut-out.
 */

const SIZES = {
  sm: 'w-16',
  md: 'w-24',
  lg: 'w-32',
} as const;

export function Mascot({
  size = 'md',
  className,
  glow = true,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  glow?: boolean;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)}>
      {glow ? (
        <span
          aria-hidden
          className="absolute inset-0 -m-3 rounded-full bg-trace-accent/10 blur-xl"
        />
      ) : null}
      <img
        src="/icons/mascot-cutout.png"
        alt=""
        aria-hidden
        width={384}
        height={417}
        loading="lazy"
        decoding="async"
        className={cn('relative h-auto opacity-90', SIZES[size])}
      />
    </span>
  );
}
