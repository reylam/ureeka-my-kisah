import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { BUILD_STATUS, LIMITS } from '@/trace/data/content';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Limits, and the build status beside them.
 *
 * The status list is the part that keeps the rest of the site honest: three
 * rows say "built", three say "not built", and the three that are not built
 * are the ones a visitor would otherwise assume were.
 */
export function Limits() {
  return (
    <SectionBand id="limits" labelledBy="limits-heading">
      <Container>
        <SectionHeading
          id="limits-heading"
          index="04"
          eyebrow="Jujur apa adanya"
          title="Di mana tools seperti ini kurang andal"
          standfirst="Bukan sekadar catatan kecil. Ini alasan-alasan spesifik kenapa software pembaca X-ray bisa tampak mengesankan di demo tapi tetap mengecewakan di klinik."
        />

        <div className="mt-11 grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {LIMITS.map((limit) => (
              <div key={limit.title} className="border-t border-trace-line pt-5">
                <dt className="text-[16px] font-medium text-trace-text">{limit.title}</dt>
                <dd className="mt-2.5 text-[14px] leading-6 text-trace-muted">{limit.body}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-2xl border border-trace-line bg-trace-card p-6">
            <h3 className="trace-label text-trace-dim">Yang sudah ada saat ini</h3>
            <ul className="mt-5 space-y-3.5">
              {BUILD_STATUS.map((row) => (
                <li key={row.label} className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-px grid size-5 shrink-0 place-items-center rounded-full border',
                      row.done
                        ? 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent'
                        : 'border-trace-line bg-trace-raised text-trace-dim',
                    )}
                  >
                    {row.done ? (
                      <Check aria-hidden className="size-3" strokeWidth={3} />
                    ) : (
                      <Minus aria-hidden className="size-3" strokeWidth={3} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-trace-text">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[12.5px]',
                        row.done ? 'text-trace-dim' : 'text-trace-flag',
                      )}
                    >
                      {row.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
