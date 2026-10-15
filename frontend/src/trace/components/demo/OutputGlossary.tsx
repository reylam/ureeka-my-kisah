import { OUTPUT_GLOSSARY } from '@/trace/data/demoResults';
import { Callout } from '@/trace/components/ui/Callout';

/**
 * Three things that get treated as the same thing and are not: what the
 * software computed, how sure it claims to be, and what is actually wrong with
 * a person. The callout underneath is the point of the section.
 */
export function OutputGlossary() {
  return (
    <div>
      <dl className="grid gap-4 lg:grid-cols-3">
        {OUTPUT_GLOSSARY.map((entry, index) => (
          <div key={entry.term} className="rounded-2xl border border-trace-line bg-trace-card p-6">
            <dt>
              <span className="trace-label text-trace-dim">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-2.5 block text-[17px] font-medium text-trace-text">
                {entry.term}
              </span>
            </dt>
            <dd className="mt-3 text-[14px] leading-6 text-trace-muted">{entry.body}</dd>
          </div>
        ))}
      </dl>

      <Callout label="Why the three are not the same" className="mt-8 max-w-3xl">
        They are not three strengths of the same thing. The first is a number worked out from a
        picture. The second is the software’s own claim about that number. The third is a
        conclusion about a person, reached with tests the software has no access to, by someone who
        is accountable for being wrong. Treating the first as if it were the third is the mistake
        this whole site is arranged to prevent.
      </Callout>
    </div>
  );
}
