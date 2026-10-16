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
        title="Administration"
        description="Platform totals, account activity and the directory that the public pages read from."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Users />}
          label="Patient accounts"
          value={patientAccounts.length}
          note={`${patients.length} clinical records in total`}
        />
        <Metric
          icon={<Stethoscope />}
          label="Health professionals"
          value={professionals.length}
          note={`${admins.length} administrator${admins.length === 1 ? '' : 's'}`}
        />
        <Metric
          icon={<Building2 />}
          label="Facilities"
          value={facilities.length}
          note="Hospitals, puskesmas and labs"
        />
        <Metric
          icon={<ClipboardList />}
          label="Screening records"
          value={screenings.length}
          note={`${screenings.filter((item) => item.status === 'awaiting-review').length} awaiting review`}
        />
      </div>

      {suspended.length > 0 ? (
        <Notice tone="attention" compact>
          {suspended.length} account{suspended.length === 1 ? ' is' : 's are'} suspended and cannot
          sign in.
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Recent activity"
            icon={<ScrollText />}
            description="Role changes, account status and facility edits."
            actions={
              <ButtonLink to="/admin/audit" variant="ghost" size="sm">
                Full log
              </ButtonLink>
            }
          />
          <CardBody>
            {audit.length === 0 ? (
              <EmptyState
                compact
                icon={<ScrollText />}
                title="Nothing logged yet"
                description="Changing a role, suspending an account or editing a facility will record an entry here."
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
          <CardHeader title="Common tasks" />
          <CardBody className="space-y-2.5">
            <ButtonLink to="/admin/users" variant="outline" size="sm" fullWidth>
              Accounts and roles
            </ButtonLink>
            <ButtonLink to="/admin/facilities" variant="outline" size="sm" fullWidth>
              Facility directory
            </ButtonLink>
            <ButtonLink to="/admin/screenings" variant="outline" size="sm" fullWidth>
              Screening record metadata
            </ButtonLink>
            <p className="pt-1 text-[12px] leading-relaxed text-obsidian-500">
              Administrative access is not clinical access. Patient images and reports stay with
              the professionals assigned to that patient.
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
