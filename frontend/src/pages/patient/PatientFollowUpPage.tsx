import { CalendarClock, Phone, Send } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import {
  FollowUpBucketBadge,
  ReferralPriorityBadge,
  ReferralStatusBadge,
} from '@/components/ui/StatusBadge';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { followUpBucket } from '@/stores/selectors';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import { formatDate, formatDueLabel } from '@/utils/date';
import { facilityServiceLabel, followUpReasonLabel } from '@/utils/labels';

/**
 * Follow-up and referrals, from the patient's side.
 *
 * Shows what has been arranged for them and who arranged it. It does not
 * create, confirm or reschedule anything: those are the care team's actions,
 * and a patient-facing button that appeared to book an appointment with no
 * system behind it would be a promise the product cannot keep.
 */
export function PatientFollowUpPage() {
  const { followUps, referrals } = usePatientRecords();
  const open = followUps.filter((item) => item.status !== 'completed');
  const done = followUps.filter((item) => item.status === 'completed');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-up"
        description="Appointments, referrals and contact arranged by the people looking after you."
      />

      <Card>
        <CardHeader title="Scheduled" icon={<CalendarClock />} />
        <CardBody className="space-y-3">
          {open.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Nothing scheduled"
              description="When your care team plans a visit, a test or a call, it will appear here."
            />
          ) : (
            open.map((followUp) => {
              const worker = users.find((user) => user.id === followUp.assignedWorkerId);
              return (
                <div
                  key={followUp.id}
                  className="rounded-card border border-obsidian-200 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <FollowUpBucketBadge bucket={followUpBucket(followUp)} />
                    <span className="text-[13px] font-medium text-obsidian-900">
                      {followUpReasonLabel[followUp.reason]}
                    </span>
                  </div>
                  <dl className="mt-2.5 divide-y divide-obsidian-100">
                    <DetailRow label="Due">
                      {formatDate(followUp.dueDate)} · {formatDueLabel(followUp.dueDate)}
                    </DetailRow>
                    {worker ? <DetailRow label="Contact">{worker.name}</DetailRow> : null}
                    {worker?.phone ? (
                      <DetailRow label="Phone">
                        <a
                          href={`tel:${worker.phone.replace(/\s|-/g, '')}`}
                          className="inline-flex items-center gap-1.5 text-ct-700 underline underline-offset-2"
                        >
                          <Phone aria-hidden className="size-3.5" />
                          {worker.phone}
                        </a>
                      </DetailRow>
                    ) : null}
                  </dl>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Referrals"
          icon={<Send />}
          description="Where you have been sent for further testing or treatment."
        />
        <CardBody className="space-y-3">
          {referrals.length === 0 ? (
            <EmptyState
              compact
              icon={<Send />}
              title="No referrals"
              description="A referral is created when your care team wants another facility to run a test or take over part of your care."
            />
          ) : (
            referrals.map((referral) => {
              const destination = facilities.find((item) => item.id === referral.toFacilityId);
              return (
                <div key={referral.id} className="rounded-card border border-obsidian-200 p-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ReferralStatusBadge status={referral.status} />
                    <ReferralPriorityBadge priority={referral.priority} />
                    <span className="font-mono text-[12px] text-obsidian-500">{referral.code}</span>
                  </div>
                  <dl className="mt-2.5 divide-y divide-obsidian-100">
                    <DetailRow label="Going to">
                      {destination ? `${destination.name}, ${destination.region}` : 'A facility'}
                    </DetailRow>
                    <DetailRow label="For">
                      {facilityServiceLabel[referral.requestedService]}
                    </DetailRow>
                    {referral.appointmentDate ? (
                      <DetailRow label="Appointment">
                        {formatDate(referral.appointmentDate)}
                      </DetailRow>
                    ) : null}
                    {destination?.phone ? (
                      <DetailRow label="Facility phone">{destination.phone}</DetailRow>
                    ) : null}
                  </dl>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      {done.length > 0 ? (
        <Card>
          <CardHeader title="Completed" description={`${done.length} earlier follow-ups.`} />
          <CardBody>
            <ul className="space-y-2">
              {done.map((followUp) => (
                <li
                  key={followUp.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                >
                  <span className="text-obsidian-700">
                    {followUpReasonLabel[followUp.reason]}
                  </span>
                  <span className="text-obsidian-500">
                    {followUp.completedAt ? formatDate(followUp.completedAt) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Notice tone="info" compact>
        Appointments are arranged by your care team, not from this page. If a date does not suit
        you, call the contact shown above rather than waiting.
      </Notice>
    </div>
  );
}
