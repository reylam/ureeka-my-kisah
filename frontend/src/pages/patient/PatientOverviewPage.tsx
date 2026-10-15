import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  Stethoscope,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { ScreeningStatusBadge, FollowUpBucketBadge } from '@/components/ui/StatusBadge';
import { useCurrentAccount } from '@/stores/authStore';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { STAGE_RECOMMENDATION, articleById } from '@/data/education';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import { formatDate, formatDueLabel } from '@/utils/date';
import { followUpReasonLabel } from '@/utils/labels';
import { followUpBucket } from '@/stores/selectors';

/**
 * Patient overview.
 *
 * Answers four questions in the order a patient actually asks them: where is
 * my last screening up to, is anyone expecting me anywhere, who is looking
 * after me, and what should I read. Nothing on this page produces a clinical
 * judgement, and the only numbers shown are counts of the patient's own
 * records.
 */
export function PatientOverviewPage() {
  const account = useCurrentAccount();
  const { patient, screenings, followUps, latest, stage, referrals } = usePatientRecords();

  const firstName = (account?.onboarding.personal?.fullName ?? account?.name ?? '').split(' ')[0];
  const recommendation = STAGE_RECOMMENDATION[stage];
  const nextFollowUp = followUps.find((item) => item.status !== 'completed') ?? null;
  const careWorker = nextFollowUp
    ? users.find((user) => user.id === nextFollowUp.assignedWorkerId)
    : null;
  const homeFacility = patient
    ? facilities.find((item) => item.id === patient.homeFacilityId)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : 'Your health overview'}
        description="Your screening history, anything coming up, and reading that fits where you are."
      />

      {/* Latest screening */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Latest screening"
            icon={<ClipboardList />}
            actions={
              screenings.length > 0 ? (
                <ButtonLink
                  to="/me/screenings"
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight className="ml-1.5 size-3.5" />}
                >
                  All screenings
                </ButtonLink>
              ) : null
            }
          />
          <CardBody>
            {latest ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <ScreeningStatusBadge status={latest.status} />
                  <span className="text-[13px] text-obsidian-600">
                    Recorded {formatDate(latest.performedAt)}
                  </span>
                </div>

                <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
                  {latest.status === 'reviewed'
                    ? 'A health professional has looked at this screening and recorded their assessment. Open the record to read it.'
                    : latest.status === 'referred'
                      ? 'This screening led to a referral for further testing. Your follow-up section has the details.'
                      : 'This screening is still working through the review queue. A health professional checks every record before anything is concluded from it.'}
                </p>

                <ButtonLink to="/me/screenings" variant="outline" size="sm">
                  Open the record
                </ButtonLink>
              </div>
            ) : (
              <EmptyState
                compact
                icon={<ClipboardList />}
                title="No screenings on your record yet"
                description="When a health worker records a chest X-ray screening for you, it will appear here with its status and report."
                action={
                  <ButtonLink to="/me/facilities" variant="outline" size="sm">
                    Find a facility near you
                  </ButtonLink>
                }
              />
            )}
          </CardBody>
        </Card>

        {/* Counts of the patient's own records only */}
        <Card>
          <CardHeader title="Your record" icon={<Stethoscope />} />
          <CardBody className="space-y-3">
            <Stat label="Screenings" value={screenings.length} />
            <Stat label="Referrals" value={referrals.length} />
            <Stat
              label="Follow-ups scheduled"
              value={followUps.filter((item) => item.status !== 'completed').length}
            />
            {homeFacility ? (
              <p className="border-t border-obsidian-100 pt-3 text-[12.5px] leading-relaxed text-obsidian-500">
                Registered at {homeFacility.name}, {homeFacility.region}.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* Follow-up */}
      <Card>
        <CardHeader
          title="Coming up"
          icon={<CalendarClock />}
          description="Appointments and contact arranged by your care team."
        />
        <CardBody>
          {nextFollowUp ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <FollowUpBucketBadge bucket={followUpBucket(nextFollowUp)} />
                  <span className="text-[13px] font-medium text-obsidian-900">
                    {followUpReasonLabel[nextFollowUp.reason]}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-obsidian-600">
                  Due {formatDate(nextFollowUp.dueDate)} ·{' '}
                  {formatDueLabel(nextFollowUp.dueDate)}
                </p>
                {careWorker ? (
                  <p className="mt-1 text-[12.5px] text-obsidian-500">
                    Arranged by {careWorker.name}
                  </p>
                ) : null}
              </div>
              <ButtonLink to="/me/followup" variant="outline" size="sm">
                Follow-up details
              </ButtonLink>
            </div>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Nothing scheduled"
              description="If your care team arranges an appointment or plans to contact you, it will show here."
            />
          )}
        </CardBody>
      </Card>

      {/* Suggested reading */}
      <Card>
        <CardHeader
          title={recommendation.heading}
          icon={<GraduationCap />}
          description={recommendation.reason}
          actions={
            <ButtonLink to="/me/learn" variant="ghost" size="sm">
              All topics
            </ButtonLink>
          }
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-3">
            {recommendation.articleIds.map((id) => {
              const article = articleById(id);
              if (!article) return null;
              return (
                <li key={id}>
                  <Link
                    to={`/me/learn?article=${id}`}
                    className="flex h-full flex-col rounded-card border border-obsidian-200 p-3.5 transition-colors hover:border-ct-300 hover:bg-ct-50/40"
                  >
                    <span className="text-[13px] font-medium text-obsidian-900">
                      {article.title}
                    </span>
                    <span className="mt-1.5 text-[12.5px] leading-relaxed text-obsidian-500">
                      {article.summary}
                    </span>
                    <span className="mt-auto pt-3 text-[11.5px] text-obsidian-400">
                      {article.minutes} min read
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Notice tone="attention" compact>
        PULMO does not diagnose tuberculosis. Everything here is to help you keep track and decide
        whether to get tested. If you feel unwell, see a health professional rather than waiting for
        anything on this page to change.
      </Notice>

      <Card>
        <CardHeader title="Find care" icon={<Building2 />} />
        <CardBody>
          <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
            The directory lists hospitals and puskesmas with their services, opening hours and
            contact details, so you can see which ones can run a TB test.
          </p>
          <ButtonLink to="/me/facilities" variant="outline" size="sm" className="mt-3">
            Browse facilities
          </ButtonLink>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-obsidian-600">{label}</span>
      <span className="text-lg font-semibold text-obsidian-950 tabular">{value}</span>
    </div>
  );
}
