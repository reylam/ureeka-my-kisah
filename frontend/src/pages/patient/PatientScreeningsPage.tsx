import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { ImageQualityBadge, ScreeningStatusBadge } from '@/components/ui/StatusBadge';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import { formatDate, formatDateTime } from '@/utils/date';
import { screeningStatusLabel } from '@/utils/labels';

/**
 * The patient's own screening history.
 *
 * Deliberately shows workflow state and the reviewer's conclusion, and not the
 * analysis output on its own. A patient reading "flagged" without the clinical
 * assessment beside it has been handed a frightening word and nothing to do
 * with it, so the review is what this page leads with and the record is marked
 * as still in progress until one exists.
 */
export function PatientScreeningsPage() {
  const { screenings } = usePatientRecords();

  return (
    <div className="space-y-5">
      <PageHeader
        title="My screenings"
        description="Every chest X-ray screening recorded for you, and where each one has got to."
      />

      {screenings.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList />}
              title="Nothing recorded yet"
              description="Screenings are recorded by a health worker at a facility. When one is added to your record it will appear here, along with the report once a professional has reviewed it."
              action={
                <ButtonLink to="/me/facilities" variant="outline" size="sm">
                  Find a facility
                </ButtonLink>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {screenings.map((screening) => {
            const operator = users.find((user) => user.id === screening.operatorId);
            const facility = facilities.find((item) => item.id === screening.facilityId);
            const reviewer = screening.review
              ? users.find((user) => user.id === screening.review?.reviewerId)
              : null;

            return (
              <Card key={screening.id}>
                <CardHeader
                  title={formatDate(screening.performedAt)}
                  description={facility ? `${facility.name}, ${facility.region}` : undefined}
                  actions={<ScreeningStatusBadge status={screening.status} />}
                />
                <CardBody className="space-y-4">
                  <dl className="divide-y divide-obsidian-100">
                    <DetailRow label="Recorded by">
                      {operator ? operator.name : 'A health worker'}
                    </DetailRow>
                    <DetailRow label="Image quality">
                      <ImageQualityBadge quality={screening.imageQuality} size="sm" />
                    </DetailRow>
                    <DetailRow label="Status">{screeningStatusLabel[screening.status]}</DetailRow>
                  </dl>

                  {/* The reviewer's words, not the model's */}
                  {screening.review ? (
                    <div className="rounded-card border border-obsidian-200 bg-obsidian-50 p-3.5">
                      <p className="text-[13px] font-semibold text-obsidian-900">
                        What your care team recorded
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-obsidian-700">
                        {screening.review.notes}
                      </p>
                      <p className="mt-2.5 text-[12px] text-obsidian-500">
                        {reviewer ? `${reviewer.name} · ` : ''}
                        {formatDateTime(screening.review.reviewedAt)}
                      </p>
                    </div>
                  ) : (
                    <Notice tone="info" compact>
                      This screening has not been reviewed yet. A health professional checks every
                      record before any conclusion is drawn from it, so there is nothing to read
                      into the delay.
                    </Notice>
                  )}

                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Notice tone="attention" compact>
        A screening result is never a diagnosis. Tuberculosis is confirmed by a laboratory test on
        a sputum sample, read together with your symptoms by a clinician.
      </Notice>
    </div>
  );
}
