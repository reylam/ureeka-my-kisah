import { useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, UserCog, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { DataTable, StackedCell, type Column } from '@/components/ui/DataTable';
import { NoMatchesState } from '@/components/ui/EmptyState';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/forms/Field';
import { Checkbox, SearchInput, Select } from '@/components/forms/Inputs';
import { useAccountStore } from '@/stores/accountStore';
import { useDataStore } from '@/stores/dataStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { useCurrentAccount } from '@/stores/authStore';
import { ROLE_LABEL } from '@/lib/permissions';
import type { Account, AccountRole, StaffProfile } from '@/types/account';
import { users } from '@/data/users';
import { formatDate } from '@/utils/date';
import { facilityTypeLabel, userRoleLabel } from '@/utils/labels';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/apiClient';

/**
 * Account management.
 *
 * Two rules are checked here for a clear message, and enforced again by the API
 * and the database, because both are the kind of mistake that locks an
 * organisation out of its own system:
 *
 *   An administrator cannot change their own role, and cannot suspend
 *   themselves. Either one can remove the last administrator in a single
 *   click with no way back through the interface.
 *
 * Passwords are never shown, never returned by the API, and there is no
 * control here that could reveal one. Credentials live in Supabase Auth.
 */
export function AdminUsersPage() {
  const actor = useCurrentAccount();
  const accounts = useAccountStore((state) => state.accounts);
  const setRole = useAccountStore((state) => state.setRole);
  const setStatus = useAccountStore((state) => state.setStatus);
  const saveStaffProfile = useAccountStore((state) => state.saveStaffProfile);
  const removeStaffProfile = useAccountStore((state) => state.removeStaffProfile);
  const patients = useDataStore((state) => state.patients);
  const placePatient = useDataStore((state) => state.placePatient);
  const facilityList = useFacilityStore((state) => state.facilities);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AccountRole | 'all'>('all');
  const [pendingSuspend, setPendingSuspend] = useState<Account | null>(null);
  const [staffTarget, setStaffTarget] = useState<Account | null>(null);
  const [staffDraft, setStaffDraft] = useState<StaffProfile>({
    clinicalRole: 'nurse',
    canReview: false,
    facilityId: '',
    phone: null,
  });
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);

  const adminCount = accounts.filter(
    (account) => account.role === 'admin' && account.status === 'active',
  ).length;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts
      .filter((account) => (roleFilter === 'all' ? true : account.role === roleFilter))
      .filter((account) =>
        needle
          ? account.name.toLowerCase().includes(needle) ||
            account.email.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, query, roleFilter]);

  const changeRole = async (account: Account, role: AccountRole) => {
    if (!actor) return;
    if (account.id === actor.id) {
      toast.error('Kamu tidak bisa mengubah role sendiri.', 'Minta administrator lain untuk melakukannya.');
      return;
    }
    if (account.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      toast.error('Ini administrator aktif terakhir.', 'Jadikan orang lain administrator terlebih dahulu.');
      return;
    }
    try {
      await setRole(account.id, role);
      toast.success(`${account.name} sekarang berperan sebagai ${ROLE_LABEL[role].toLowerCase()}.`);
    } catch (cause) {
      toast.error('Role tidak bisa diubah.', errorMessage(cause));
    }
  };

  const openStaff = (account: Account) => {
    setStaffDraft(
      account.staff ?? {
        clinicalRole: account.role === 'admin' ? 'coordinator' : 'nurse',
        canReview: false,
        facilityId: facilityList[0]?.id ?? '',
        phone: null,
      },
    );
    setStaffError(null);
    setStaffTarget(account);
  };

  const saveStaff = async () => {
    if (!staffTarget) return;
    if (!staffDraft.facilityId) {
      setStaffError('Pilih fasilitas tempat orang ini bekerja.');
      return;
    }
    setStaffSaving(true);
    try {
      await saveStaffProfile(staffTarget.id, {
        ...staffDraft,
        // Administrative access is never clinical, whatever the box says.
        canReview: staffTarget.role === 'professional' && staffDraft.canReview,
      });
      toast.success('Data staf disimpan.');
      setStaffTarget(null);
    } catch (cause) {
      setStaffError(errorMessage(cause));
    } finally {
      setStaffSaving(false);
    }
  };

  const clearStaff = async () => {
    if (!staffTarget) return;
    setStaffSaving(true);
    try {
      await removeStaffProfile(staffTarget.id);
      toast.success('Data staf dihapus.');
      setStaffTarget(null);
    } catch (cause) {
      setStaffError(errorMessage(cause));
    } finally {
      setStaffSaving(false);
    }
  };

  const place = async (account: Account, facilityId: string) => {
    if (!account.patientId) return;
    try {
      await placePatient(account.patientId, facilityId || null);
      toast.success(
        facilityId ? `${account.name} ditempatkan di fasilitas.` : `${account.name} tidak lagi ditempatkan.`,
        facilityId ? 'Petugas kesehatan di sana sekarang bisa melihat pasien ini.' : undefined,
      );
    } catch (cause) {
      toast.error('Pasien tidak bisa ditempatkan.', errorMessage(cause));
    }
  };

  const confirmSuspend = async () => {
    if (!actor || !pendingSuspend) return;
    const next = pendingSuspend.status === 'active' ? 'suspended' : 'active';
    try {
      await setStatus(pendingSuspend.id, next);
      toast.success(next === 'suspended' ? 'Akun ditangguhkan.' : 'Akun diaktifkan kembali.');
    } catch (cause) {
      toast.error('Status akun tidak bisa diubah.', errorMessage(cause));
    }
    setPendingSuspend(null);
  };

  const columns: Column<Account>[] = [
    {
      id: 'name',
      header: 'Nama',
      cell: (account) => <StackedCell primary={account.name} secondary={account.email} />,
    },
    {
      id: 'role',
      header: 'Role',
      cell: (account) => (
        <Select
          aria-label={`Role untuk ${account.name}`}
          value={account.role}
          onChange={(event) => void changeRole(account, event.target.value as AccountRole)}
          disabled={account.id === actor?.id}
          className="max-w-44"
        >
          <option value="patient">{ROLE_LABEL.patient}</option>
          <option value="professional">{ROLE_LABEL.professional}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </Select>
      ),
    },
    {
      id: 'staff',
      header: 'Data staf / fasilitas',
      hideBelow: 'lg',
      cell: (account) => {
        if (account.role === 'patient') {
          // A patient is placed at a facility by an administrator; that is what
          // decides which professionals can see their record.
          const record = patients.find((patient) => patient.id === account.patientId);
          if (!record) return <span className="text-obsidian-400">Belum ada rekam klinis</span>;
          return (
            <Select
              aria-label={`Fasilitas asal untuk ${account.name}`}
              value={record.homeFacilityId}
              onChange={(event) => void place(account, event.target.value)}
              className="max-w-56"
            >
              <option value="">Belum ditempatkan di fasilitas</option>
              {facilityList.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </Select>
          );
        }
        const staff = users.find((user) => user.id === account.staffUserId);
        return (
          <div className="flex items-center gap-2">
            {staff ? (
              <StackedCell
                primary={staff.name}
                secondary={
                  account.role === 'admin'
                    ? 'Administratif, bukan klinis'
                    : staff.canReview
                      ? 'Bisa menyetujui review'
                      : 'Tidak bisa menyetujui review'
                }
              />
            ) : (
              <Badge tone="attention" size="sm" icon={<ShieldAlert />}>
                Belum terhubung
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => openStaff(account)}>
              {staff ? 'Ubah' : 'Atur'}
            </Button>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: (account) =>
        account.status === 'active' ? (
          <Badge tone="complete" size="sm" icon={<ShieldCheck />}>
            Aktif
          </Badge>
        ) : (
          <Badge tone="urgent" size="sm" icon={<ShieldAlert />}>
            Ditangguhkan
          </Badge>
        ),
    },
    {
      id: 'created',
      header: 'Bergabung',
      hideBelow: 'md',
      cell: (account) => (
        <StackedCell
          primary={formatDate(account.createdAt)}
          secondary={
            account.lastSignInAt ? `Terakhir masuk ${formatDate(account.lastSignInAt)}` : 'Belum pernah masuk'
          }
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Aksi',
      align: 'right',
      cell: (account) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={account.id === actor?.id}
          onClick={() => setPendingSuspend(account)}
        >
          {account.status === 'active' ? 'Tangguhkan' : 'Aktifkan kembali'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Akun"
        description="Semua orang yang punya akun masuk, role-nya, dan apakah akunnya masih bisa dipakai."
      />

      <Notice tone="info" compact>
        Siapa pun yang mendaftar lewat form publik otomatis menjadi pasien. Menaikkan seseorang
        menjadi petugas kesehatan adalah tindakan yang disengaja di sini, dan setiap perubahan
        dicatat di audit log.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} dari ${accounts.length} akun`}
          icon={<Users />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Cari akun"
                value={query}
                onChange={setQuery}
                placeholder="Nama atau email"
              />
              <Select
                aria-label="Filter berdasarkan role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as AccountRole | 'all')}
                className="max-w-48"
              >
                <option value="all">Semua role</option>
                <option value="patient">{ROLE_LABEL.patient}</option>
                <option value="professional">{ROLE_LABEL.professional}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </Select>
            </div>
          }
        />
        <CardBody padded={false}>
          {rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState
                entity="akun"
                onClear={() => {
                  setQuery('');
                  setRoleFilter('all');
                }}
              />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(account) => account.id}
              caption="Akun terdaftar beserta role dan statusnya"
              renderMobileCard={(account) => (
                <div className="space-y-2">
                  <StackedCell primary={account.name} secondary={account.email} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral" size="sm" icon={<UserCog />}>
                      {ROLE_LABEL[account.role]}
                    </Badge>
                    {account.status === 'suspended' ? (
                      <Badge tone="urgent" size="sm" icon={<ShieldAlert />}>
                        Ditangguhkan
                      </Badge>
                    ) : null}
                  </div>
                </div>
              )}
            />
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingSuspend)}
        onClose={() => setPendingSuspend(null)}
        onConfirm={() => void confirmSuspend()}
        title={
          pendingSuspend?.status === 'active' ? 'Tangguhkan akun ini?' : 'Aktifkan kembali akun ini?'
        }
        confirmLabel={pendingSuspend?.status === 'active' ? 'Tangguhkan' : 'Aktifkan kembali'}
        tone={pendingSuspend?.status === 'active' ? 'danger' : 'default'}
      >
        {pendingSuspend?.status === 'active' ? (
          <>
            <strong>{pendingSuspend?.name}</strong> tidak akan bisa masuk. Datanya tetap
            tersimpan dan tidak ada yang dihapus.
          </>
        ) : (
          <>
            <strong>{pendingSuspend?.name}</strong> akan bisa masuk lagi.
          </>
        )}
      </ConfirmDialog>

      <Dialog
        open={Boolean(staffTarget)}
        onClose={() => setStaffTarget(null)}
        title="Data staf"
        description={
          staffTarget
            ? `${staffTarget.name}. Fasilitas menentukan pasien mana yang ditugaskan ke orang ini.`
            : undefined
        }
        footer={
          <>
            {staffTarget?.staff ? (
              <Button variant="ghost" onClick={() => void clearStaff()} disabled={staffSaving}>
                Hapus data
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setStaffTarget(null)} disabled={staffSaving}>
              Batal
            </Button>
            <Button variant="primary" loading={staffSaving} onClick={() => void saveStaff()}>
              Simpan data
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role klinis" required>
            {({ id }) => (
              <Select
                id={id}
                value={staffDraft.clinicalRole}
                onChange={(event) =>
                  setStaffDraft((c) => ({
                    ...c,
                    clinicalRole: event.target.value as StaffProfile['clinicalRole'],
                  }))
                }
              >
                {(Object.keys(userRoleLabel) as StaffProfile['clinicalRole'][]).map((role) => (
                  <option key={role} value={role}>
                    {userRoleLabel[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Fasilitas" error={staffError} required>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                value={staffDraft.facilityId}
                describedBy={describedBy}
                invalid={invalid}
                onChange={(event) => setStaffDraft((c) => ({ ...c, facilityId: event.target.value }))}
              >
                <option value="">Pilih fasilitas</option>
                {facilityList.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} ({facilityTypeLabel[facility.type]})
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {staffTarget?.role === 'professional' ? (
            <Checkbox
              label="Bisa menyetujui review screening"
              description="Sebaiknya hanya perawat dan dokter yang punya akses ini. Kader kesehatan mencatat screening tetapi tidak menyetujuinya."
              checked={staffDraft.canReview}
              onChange={(checked) => setStaffDraft((c) => ({ ...c, canReview: checked }))}
            />
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
