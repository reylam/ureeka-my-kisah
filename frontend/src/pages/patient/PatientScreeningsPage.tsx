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
        title="Screening saya"
        description="Semua screening chest X-ray yang tercatat untuk kamu, beserta perkembangan masing-masing."
      />

      {screenings.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList />}
              title="Belum ada yang tercatat"
              description="Screening dicatat oleh petugas kesehatan di fasilitas. Saat ada yang ditambahkan ke rekam kamu, screening itu akan muncul di sini, beserta report-nya setelah ditinjau tenaga profesional."
              action={
                <ButtonLink to="/me/facilities" variant="outline" size="sm">
                  Cari fasilitas
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
                    <DetailRow label="Dicatat oleh">
                      {operator ? operator.name : 'Petugas kesehatan'}
                    </DetailRow>
                    <DetailRow label="Kualitas gambar">
                      <ImageQualityBadge quality={screening.imageQuality} size="sm" />
                    </DetailRow>
                    <DetailRow label="Status">{screeningStatusLabel[screening.status]}</DetailRow>
                  </dl>

                  {/* The reviewer's words, not the model's */}
                  {screening.review ? (
                    <div className="rounded-card border border-obsidian-200 bg-obsidian-50 p-3.5">
                      <p className="text-[13px] font-semibold text-obsidian-900">
                        Catatan dari tim yang merawat kamu
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
                      Screening ini belum ditinjau. Tenaga kesehatan profesional memeriksa setiap
                      rekam sebelum ada kesimpulan yang diambil, jadi tidak perlu mengartikan
                      apa-apa dari waktu tunggunya.
                    </Notice>
                  )}

                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Notice tone="attention" compact>
        Hasil screening bukan diagnosis. Tuberkulosis dikonfirmasi lewat tes laboratorium pada
        sampel dahak, lalu dibaca bersama gejala kamu oleh klinisi.
      </Notice>
    </div>
  );
}
