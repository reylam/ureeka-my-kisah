import { OUTPUT_GLOSSARY } from '@/trace/data/demoResults';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';

/**
 * Three terms that get used interchangeably and should not be.
 *
 * The callout underneath is the actual payload of this section: the three are
 * not steps on one scale, they are statements about different things — a
 * computation, a model's self-report, and a clinical conclusion about a person.
 */
export function OutputGlossary() {
  return (
    <div>
      <dl className="grid gap-4 lg:grid-cols-3">
        {OUTPUT_GLOSSARY.map((entry, index) => (
          <div
            key={entry.term}
            className="rounded-md border border-trace-line bg-trace-card p-5"
          >
            <dt>
              <span className="trace-label text-trace-dim">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-2 block text-[16px] font-medium text-trace-text">
                {entry.term}
              </span>
            </dt>
            <dd className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">{entry.body}</dd>
          </div>
        ))}
      </dl>

      <ResearchCallout label="Why these are not interchangeable" className="mt-6">
        They are not three degrees of the same quantity. A model output is a number computed from
        pixels. A confidence is a model’s claim about its own number, which is only meaningful once
        it has been calibrated. A diagnosis is a conclusion about a person, reached with tests the
        model does not have access to and carrying accountability the model cannot hold. Treating
        the first as the third is the failure mode this entire site is arranged against.
      </ResearchCallout>
    </div>
  );
}
