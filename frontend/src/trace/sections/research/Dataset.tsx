import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { FieldTable, DataTable, type Column } from '@/trace/components/ui/DataTable';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { ResearchChart } from '@/trace/components/charts/ResearchChart';
import { StackedBars } from '@/trace/components/charts/StackedBars';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import {
  CANDIDATE_DATASETS,
  CLASS_DISTRIBUTION,
  DATASET_SUMMARY,
  DATASET_TABLE_CAPTION,
} from '@/trace/data/datasets';

type Candidate = (typeof CANDIDATE_DATASETS)[number];

const CANDIDATE_COLUMNS: Column<Candidate>[] = [
  {
    key: 'name',
    header: 'Dataset',
    render: (row) => <span className="font-medium text-trace-text">{row.name}</span>,
  },
  { key: 'holder', header: 'Held by', render: (row) => row.holder },
  { key: 'scale', header: 'Scale', render: (row) => row.scale },
  {
    key: 'status',
    header: 'Status in this project',
    render: (row) => <span className="text-trace-dim">{row.status}</span>,
  },
  {
    key: 'source',
    header: 'Reference',
    render: (row) => <SourceCitation sourceId={row.sourceId} prefix="" />,
  },
];

/**
 * Dataset documentation.
 *
 * The table is a template rather than a record: this project has not acquired
 * a dataset, so the placeholder is called "Dataset A" instead of being named
 * after a real collection. Writing a real dataset's name and size into a mock
 * table is how a mock table turns into a false citation that someone later
 * quotes in a slide deck.
 */
export function Dataset() {
  const splitRows = ['train', 'validation', 'test'].map((split) => ({
    label: split === 'train' ? 'Training' : split === 'validation' ? 'Validation' : 'Test',
    segments: CLASS_DISTRIBUTION.map((entry) => ({
      label: entry.className,
      value: entry[split as 'train' | 'validation' | 'test'],
    })),
  }));

  return (
    <SectionBand id="dataset" labelledBy="dataset-heading">
      <Container>
        <SectionHeading
          id="dataset-heading"
          index="03"
          eyebrow="Dataset documentation"
          title="Every evaluation begins with the dataset"
          standfirst="A performance figure means nothing without the dataset record behind it. These are the fields that record has to contain — including the ones this project cannot fill."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <FieldTable rows={DATASET_SUMMARY} caption={DATASET_TABLE_CAPTION} />

          <div className="space-y-5">
            <ResearchChart
              title="Class composition by split"
              subtitle="Placeholder counts matching the table"
              provenance="illustrative"
              sampleSize="4 800 images"
              caption="The positive class is the small one in every public TB radiograph collection. That is why accuracy is the wrong summary statistic and why the raw counts are printed next to the bars."
            >
              <StackedBars rows={splitRows} />
            </ResearchChart>

            <ResearchCallout label="The field that decides everything" tone="caution">
              <strong>Reference standard.</strong> If the TB label was assigned by reading the
              radiograph, then a model trained on it learns to imitate a radiologist, and its
              ceiling is that radiologist's agreement rate. If the label came from bacteriological
              confirmation, the model is being asked a harder and more useful question. These two
              studies look identical in a metrics table and are not the same study.
            </ResearchCallout>
          </div>
        </div>

        <ResearchCallout label="Why patient-level splitting is not a detail" className="mt-10">
          Two radiographs of the same person, one in training and one in test, let a model recognise
          the person rather than the disease. The result is a high score that collapses on new
          patients. It is among the most frequently repeated errors in chest-imaging machine
          learning, and it is undetectable from the metrics alone — which is why the split strategy
          belongs in the dataset table, next to the sample size.
          <SourceCitation sourceId="pitfalls" className="mt-3" />
        </ResearchCallout>

        <div className="mt-10">
          <h3 className="text-[17px] font-medium text-trace-text">
            Public datasets this interface is prepared to document
          </h3>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-trace-muted">
            Listed as candidates. None has been obtained, licensed or evaluated by this project, and
            the status column says so for each one individually rather than once in a footnote.
          </p>
          <DataTable
            className="mt-4"
            columns={CANDIDATE_COLUMNS}
            rows={[...CANDIDATE_DATASETS]}
            rowKey={(row) => row.name}
            caption="Candidate datasets. Inclusion here is not a claim of use — the status column is the operative field."
          />
        </div>
      </Container>
    </SectionBand>
  );
}
