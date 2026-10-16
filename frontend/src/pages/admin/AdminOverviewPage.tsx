import { Building2, ClipboardList, ScrollText, Stethoscope, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { useAccountStore } from '@/stores/accountStore';
import { useDataStore } from '@/stores/dataStore';
import { facilities } from '@/data/facilities';
import { formatDateTime } from '@/utils/date';
import { AUDIT_LABEL } from './auditLabels';

/**
 * Administration overview.
 *
 * Every number here is a live count of what the API returned for an
 * administrator, not a figure typed into the page. If there is little data the
 * numbers are small, and that is the correct thing to show.
 */
export function AdminOverviewPage() {
  const accounts = useAccountStore((state) => state.accounts);
  const audit = useAccountStore((state) => state.audit);
  const screenings = useDataStore((state) => state.screenings);
  const patients = useDataStore((state) => state.patients);

  const patientAccounts = accounts.filter((account) => account.role === 'patient');
  const professionals = accounts.filter((account) => account.role === 'professional');
  const admins = accounts.filter((account) => account.role === 'admin');
  const suspended = accounts.filter((account) => account.status === 'suspended');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Administrasi"
        description="Total platform, aktivitas akun, dan direktori yang jadi sumber data halaman publik."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Users />}
          label="Akun pasien"
          value={patientAccounts.length}
          note={`${patients.length} rekam klinis secara total`}
        />
        <Metric
          icon={<Stethoscope />}
          label="Tenaga kesehatan"
          value={professionals.length}
          note={`${admins.length} administrator`}
        />
        <Metric
          icon={<Building2 />}
          label="Fasilitas"
          value={facilities.length}
          note="Rumah sakit, puskesmas, dan lab"
        />
        <Metric
          icon={<ClipboardList />}
          label="Rekam screening"
          value={screenings.length}
          note={`${screenings.filter((item) => item.status === 'awaiting-review').length} menunggu review`}
        />
      </div>

      {suspended.length > 0 ? (
        <Notice tone="attention" compact>
          {suspended.length} akun ditangguhkan dan tidak bisa masuk.
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Aktivitas terbaru"
            icon={<ScrollText />}
            description="Perubahan role, status akun, dan perubahan fasilitas."
            actions={
              <ButtonLink to="/admin/audit" variant="ghost" size="sm">
                Log lengkap
              </ButtonLink>
            }
          />
          <CardBody>
            {audit.length === 0 ? (
              <EmptyState
                compact
                icon={<ScrollText />}
                title="Belum ada yang tercatat"
                description="Mengubah role, menangguhkan akun, atau mengubah fasilitas akan mencatat entri di sini."
              />
            ) : (
              <ul className="divide-y divide-obsidian-100">
                {audit.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5">
                    <span className="text-[13px] font-medium text-obsidian-900">
                      {AUDIT_LABEL[entry.action]}
                    </span>
                    <span className="text-[13px] text-obsidian-600">{entry.subject}</span>
                    <span className="ml-auto text-[12px] text-obsidian-400">
                      {formatDateTime(entry.at)}
                    </span>
                    {entry.detail ? (
                      <span className="w-full text-[12px] text-obsidian-500">{entry.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tugas umum" />
          <CardBody className="space-y-2.5">
            <ButtonLink to="/admin/users" variant="outline" size="sm" fullWidth>
              Akun dan role
            </ButtonLink>
            <ButtonLink to="/admin/facilities" variant="outline" size="sm" fullWidth>
              Direktori fasilitas
            </ButtonLink>
            <ButtonLink to="/admin/screenings" variant="outline" size="sm" fullWidth>
              Metadata rekam screening
            </ButtonLink>
            <p className="pt-1 text-[12px] leading-relaxed text-obsidian-500">
              Akses administratif bukan akses klinis. Gambar dan report pasien hanya bisa diakses
              petugas kesehatan yang ditugaskan untuk pasien tersebut.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
          <span aria-hidden className="text-ct-700 [&>svg]:size-3.5">
            {icon}
          </span>
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-obsidian-950 tabular">{value}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-obsidian-500">{note}</p>
      </CardBody>
    </Card>
  );
}
