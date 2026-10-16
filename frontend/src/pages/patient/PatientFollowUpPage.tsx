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
        description="Janji temu, referral, dan kontak yang diatur oleh tim yang merawat kamu."
      />

      <Card>
        <CardHeader title="Terjadwal" icon={<CalendarClock />} />
        <CardBody className="space-y-3">
          {open.length === 0 ? (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Belum ada jadwal"
              description="Saat tim yang merawat kamu merencanakan kunjungan, tes, atau telepon, jadwalnya akan muncul di sini."
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
                    <DetailRow label="Jatuh tempo">
                      {formatDate(followUp.dueDate)} · {formatDueLabel(followUp.dueDate)}
                    </DetailRow>
                    {worker ? <DetailRow label="Kontak">{worker.name}</DetailRow> : null}
                    {worker?.phone ? (
                      <DetailRow label="Telepon">
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
          title="Referral"
          icon={<Send />}
          description="Tempat kamu dirujuk untuk tes lanjutan atau pengobatan."
        />
        <CardBody className="space-y-3">
          {referrals.length === 0 ? (
            <EmptyState
              compact
              icon={<Send />}
              title="Belum ada referral"
              description="Referral dibuat saat tim yang merawat kamu ingin fasilitas lain menjalankan tes atau mengambil alih sebagian perawatan."
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
                    <DetailRow label="Tujuan">
                      {destination ? `${destination.name}, ${destination.region}` : 'Sebuah fasilitas'}
                    </DetailRow>
                    <DetailRow label="Untuk">
                      {facilityServiceLabel[referral.requestedService]}
                    </DetailRow>
                    {referral.appointmentDate ? (
                      <DetailRow label="Janji temu">
                        {formatDate(referral.appointmentDate)}
                      </DetailRow>
                    ) : null}
                    {destination?.phone ? (
                      <DetailRow label="Telepon fasilitas">{destination.phone}</DetailRow>
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
          <CardHeader title="Selesai" description={`${done.length} follow-up sebelumnya.`} />
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
        Janji temu diatur oleh tim yang merawat kamu, bukan dari halaman ini. Kalau tanggalnya
        tidak cocok, hubungi kontak di atas, jangan hanya menunggu.
      </Notice>
    </div>
  );
}
