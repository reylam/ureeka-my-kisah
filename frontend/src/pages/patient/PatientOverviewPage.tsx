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
        title={firstName ? `Halo, ${firstName}` : 'Ringkasan kesehatan kamu'}
        description="Riwayat screening, jadwal yang akan datang, dan bacaan yang sesuai dengan kondisi kamu."
      />

      {account && !account.onboarding.completedAt ? (
        <Notice tone="info" title="Lengkapi profil kamu">
          <p>
            Tambahkan data diri dan, kalau mau, beberapa jawaban seputar kesehatan supaya rekam
            kamu lengkap. Cuma butuh beberapa menit dan kamu bisa berhenti di langkah mana pun.
          </p>
          <ButtonLink to="/onboarding" variant="outline" size="sm" className="mt-2.5">
            Lengkapi profil
          </ButtonLink>
        </Notice>
      ) : null}

      {/* Latest screening */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Screening terbaru"
            icon={<ClipboardList />}
            actions={
              screenings.length > 0 ? (
                <ButtonLink
                  to="/me/screenings"
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight className="ml-1.5 size-3.5" />}
                >
                  Semua screening
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
                    Dicatat {formatDate(latest.performedAt)}
                  </span>
                </div>

                <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
                  {latest.status === 'reviewed'
                    ? 'Tenaga kesehatan profesional sudah memeriksa screening ini dan mencatat penilaiannya. Buka rekam untuk membacanya.'
                    : latest.status === 'referred'
                      ? 'Screening ini berlanjut ke referral untuk tes lanjutan. Detailnya ada di bagian follow-up.'
                      : 'Screening ini masih dalam antrean review. Tenaga kesehatan profesional memeriksa setiap rekam sebelum ada kesimpulan yang diambil.'}
                </p>

                <ButtonLink to="/me/screenings" variant="outline" size="sm">
                  Buka rekam
                </ButtonLink>
              </div>
            ) : (
              <EmptyState
                compact
                icon={<ClipboardList />}
                title="Belum ada screening di rekam kamu"
                description="Saat petugas kesehatan mencatat screening chest X-ray untuk kamu, screening itu akan muncul di sini lengkap dengan status dan report-nya."
                action={
                  <ButtonLink to="/me/facilities" variant="outline" size="sm">
                    Cari fasilitas di dekat kamu
                  </ButtonLink>
                }
              />
            )}
          </CardBody>
        </Card>

        {/* Counts of the patient's own records only */}
        <Card>
          <CardHeader title="Rekam kamu" icon={<Stethoscope />} />
          <CardBody className="space-y-3">
            <Stat label="Screening" value={screenings.length} />
            <Stat label="Referral" value={referrals.length} />
            <Stat
              label="Follow-up terjadwal"
              value={followUps.filter((item) => item.status !== 'completed').length}
            />
            {homeFacility ? (
              <p className="border-t border-obsidian-100 pt-3 text-[12.5px] leading-relaxed text-obsidian-500">
                Terdaftar di {homeFacility.name}, {homeFacility.region}.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* Follow-up */}
      <Card>
        <CardHeader
          title="Akan datang"
          icon={<CalendarClock />}
          description="Janji temu dan kontak yang diatur oleh tim yang merawat kamu."
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
                  Jatuh tempo {formatDate(nextFollowUp.dueDate)} ·{' '}
                  {formatDueLabel(nextFollowUp.dueDate)}
                </p>
                {careWorker ? (
                  <p className="mt-1 text-[12.5px] text-obsidian-500">
                    Diatur oleh {careWorker.name}
                  </p>
                ) : null}
              </div>
              <ButtonLink to="/me/followup" variant="outline" size="sm">
                Detail follow-up
              </ButtonLink>
            </div>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title="Belum ada jadwal"
              description="Kalau tim yang merawat kamu mengatur janji temu atau berencana menghubungi kamu, jadwalnya akan tampil di sini."
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
              Semua topik
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
                      {article.minutes} menit baca
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Notice tone="attention" compact>
        PARUPINTAS tidak mendiagnosis tuberkulosis. Semua yang ada di sini untuk membantu kamu
        memantau dan memutuskan perlu tes atau tidak. Kalau merasa tidak enak badan, temui tenaga
        kesehatan, jangan menunggu ada perubahan di halaman ini.
      </Notice>

      <Card>
        <CardHeader title="Cari layanan kesehatan" icon={<Building2 />} />
        <CardBody>
          <p className="max-w-prose text-[13px] leading-relaxed text-obsidian-600">
            Direktori ini memuat rumah sakit dan puskesmas beserta layanan, jam operasional, dan
            kontaknya, jadi kamu bisa tahu mana yang bisa melakukan tes TB.
          </p>
          <ButtonLink to="/me/facilities" variant="outline" size="sm" className="mt-3">
            Lihat fasilitas
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
