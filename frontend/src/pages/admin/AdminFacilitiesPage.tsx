import { useMemo, useState } from 'react';
import { Building2, Eye, EyeOff, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { DataTable, StackedCell, type Column } from '@/components/ui/DataTable';
import { NoMatchesState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/forms/Field';
import { Checkbox, SearchInput, Select, TextArea, TextInput } from '@/components/forms/Inputs';
import { FacilityInfoBadge } from '@/components/ui/StatusBadge';
import {
  useFacilityStore,
  type FacilityDraft,
  type ManagedFacility,
} from '@/stores/facilityStore';
import { errorMessage } from '@/lib/apiClient';
import { facilityServiceLabel, facilityTypeLabel } from '@/utils/labels';
import type { FacilityService, FacilityType } from '@/types/domain';
import { DISTRICTS, PROVINCE } from '@/data/geography';
import { formatDate } from '@/utils/date';
import { toast } from '@/stores/toastStore';

/**
 * Facility directory management.
 *
 * New entries are created unpublished. A directory that patients use to decide
 * where to go for a TB test should not gain a half-filled entry the moment
 * someone saves a form, so publishing is a separate, deliberate action after
 * the details have been checked.
 *
 * The form does not ask for coordinates or travel times. Those need a real
 * lookup; a hand-typed latitude is how a map ends up pointing at open water.
 */

const SERVICE_OPTIONS = Object.keys(facilityServiceLabel) as FacilityService[];
const TYPE_OPTIONS = Object.keys(facilityTypeLabel) as FacilityType[];

const EMPTY_DRAFT: FacilityDraft = {
  name: '',
  type: 'puskesmas',
  province: PROVINCE,
  region: '',
  address: '',
  phone: '',
  operatingHours: '',
  services: [],
  tbProgrammeContact: null,
};

export function AdminFacilitiesPage() {
  const facilities = useFacilityStore((state) => state.facilities);
  const createFacility = useFacilityStore((state) => state.create);
  const updateFacility = useFacilityStore((state) => state.update);
  const setPublished = useFacilityStore((state) => state.setPublished);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ManagedFacility | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FacilityDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return facilities
      .filter((facility) =>
        needle
          ? facility.name.toLowerCase().includes(needle) ||
            facility.region.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => Number(b.published) - Number(a.published) || a.name.localeCompare(b.name));
  }, [facilities, query]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setCreating(true);
  };

  const openEdit = (facility: ManagedFacility) => {
    setDraft({
      name: facility.name,
      type: facility.type,
      province: facility.province,
      region: facility.region,
      address: facility.address,
      phone: facility.phone,
      operatingHours: facility.operatingHours,
      services: facility.services,
      tbProgrammeContact: facility.tbProgrammeContact,
    });
    setErrors({});
    setEditing(facility);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 3) next.name = 'Isi nama fasilitas.';
    if (!draft.region.trim()) next.region = 'Pilih kabupaten/kota.';
    if (!draft.address.trim()) next.address = 'Isi alamat.';
    if (draft.phone.replace(/\D/g, '').length < 7) next.phone = 'Isi nomor kontak.';
    if (draft.services.length === 0) next.services = 'Pilih minimal satu layanan.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // The server writes the audit entry for every one of these.
  const save = async () => {
    if (!validate()) return;

    try {
      if (editing) {
        await updateFacility(editing.id, draft);
        toast.success('Fasilitas diperbarui.', 'Ditandai perlu review lagi.');
        setEditing(null);
        return;
      }

      await createFacility(draft);
      toast.success('Fasilitas ditambahkan.', 'Publikasikan setelah detailnya dicek.');
      setCreating(false);
    } catch (cause) {
      toast.error('Fasilitas tidak bisa disimpan.', errorMessage(cause));
    }
  };

  const togglePublished = async (facility: ManagedFacility) => {
    const next = !facility.published;
    try {
      await setPublished(facility.id, next);
      toast.success(next ? 'Dipublikasikan ke direktori.' : 'Dihapus dari direktori.');
    } catch (cause) {
      toast.error('Status publikasi tidak bisa diubah.', errorMessage(cause));
    }
  };

  const columns: Column<ManagedFacility>[] = [
    {
      id: 'name',
      header: 'Fasilitas',
      cell: (facility) => (
        <StackedCell
          primary={facility.name}
          secondary={`${facilityTypeLabel[facility.type]} · ${facility.region}`}
        />
      ),
    },
    {
      id: 'services',
      header: 'Layanan',
      hideBelow: 'lg',
      cell: (facility) => (
        <span className="text-obsidian-600">
          {facility.services.length === 0
            ? 'Belum ada yang tercatat'
            : facility.services.map((service) => facilityServiceLabel[service]).join(', ')}
        </span>
      ),
    },
    {
      id: 'contact',
      header: 'Kontak',
      hideBelow: 'md',
      cell: (facility) => (
        <StackedCell primary={facility.phone} secondary={facility.operatingHours || undefined} />
      ),
    },
    {
      id: 'info',
      header: 'Rekam',
      hideBelow: 'md',
      cell: (facility) => (
        <StackedCell
          primary={<FacilityInfoBadge status={facility.infoStatus} size="sm" />}
          secondary={`Diperbarui ${formatDate(facility.infoUpdatedAt)}`}
        />
      ),
    },
    {
      id: 'published',
      header: 'Direktori',
      cell: (facility) =>
        facility.published ? (
          <Badge tone="complete" size="sm" icon={<Eye />}>
            Publik
          </Badge>
        ) : (
          <Badge tone="inert" size="sm" icon={<EyeOff />}>
            Disembunyikan
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Aksi',
      align: 'right',
      cell: (facility) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil className="size-3.5" />}
            onClick={() => openEdit(facility)}
          >
            Ubah
          </Button>
          <Button variant="ghost" size="sm" onClick={() => togglePublished(facility)}>
            {facility.published ? 'Batalkan publikasi' : 'Publikasikan'}
          </Button>
        </div>
      ),
    },
  ];

  const dialogOpen = creating || Boolean(editing);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fasilitas"
        description="Rumah sakit, puskesmas, dan lab. Entri yang dipublikasikan tampil di direktori publik."
        actions={
          <Button variant="primary" leadingIcon={<Plus className="size-4" />} onClick={openCreate}>
            Tambah fasilitas
          </Button>
        }
      />

      <Notice tone="info" compact>
        Entri baru otomatis disembunyikan. Cek alamat, nomor telepon, dan layanan, lalu
        publikasikan, supaya tidak ada yang diarahkan ke fasilitas yang tidak bisa menjalankan tes
        yang dibutuhkan.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} dari ${facilities.length} fasilitas`}
          icon={<Building2 />}
          actions={
            <SearchInput
              label="Cari fasilitas"
              value={query}
              onChange={setQuery}
              placeholder="Nama atau kabupaten/kota"
            />
          }
        />
        <CardBody padded={false}>
          {rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState entity="fasilitas" onClear={() => setQuery('')} />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(facility) => facility.id}
              caption="Fasilitas kesehatan di direktori"
              renderMobileCard={(facility) => (
                <div className="space-y-2">
                  <StackedCell
                    primary={facility.name}
                    secondary={`${facilityTypeLabel[facility.type]} · ${facility.region}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {facility.published ? (
                      <Badge tone="complete" size="sm" icon={<Eye />}>
                        Publik
                      </Badge>
                    ) : (
                      <Badge tone="inert" size="sm" icon={<EyeOff />}>
                        Disembunyikan
                      </Badge>
                    )}
                    <FacilityInfoBadge status={facility.infoStatus} size="sm" />
                  </div>
                </div>
              )}
            />
          )}
        </CardBody>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Ubah fasilitas' : 'Tambah fasilitas'}
        description={
          editing
            ? 'Menyimpan akan menandai rekam ini perlu review lagi.'
            : 'Entri dibuat dalam keadaan tersembunyi sampai kamu publikasikan.'
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Batal
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Simpan perubahan' : 'Tambah fasilitas'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama fasilitas" error={errors.name ?? null} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                value={draft.name}
                onChange={(event) => setDraft((c) => ({ ...c, name: event.target.value }))}
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipe" required>
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, type: event.target.value as FacilityType }))
                  }
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {facilityTypeLabel[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Kabupaten/kota" error={errors.region ?? null} required>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  value={draft.region}
                  onChange={(event) => setDraft((c) => ({ ...c, region: event.target.value }))}
                  describedBy={describedBy}
                  invalid={invalid}
                >
                  <option value="">Pilih kabupaten/kota</option>
                  {DISTRICTS.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Alamat" error={errors.address ?? null} required>
            {({ id, describedBy, invalid }) => (
              <TextArea
                id={id}
                rows={2}
                value={draft.address}
                onChange={(event) => setDraft((c) => ({ ...c, address: event.target.value }))}
                describedBy={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telepon" error={errors.phone ?? null} required>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft((c) => ({ ...c, phone: event.target.value }))}
                  describedBy={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field label="Jam operasional" hint="Contoh: Senin sampai Jumat, 08:00 sampai 14:00">
              {({ id }) => (
                <TextInput
                  id={id}
                  value={draft.operatingHours}
                  onChange={(event) =>
                    setDraft((c) => ({ ...c, operatingHours: event.target.value }))
                  }
                />
              )}
            </Field>
          </div>

          <Field
            label="Layanan tersedia"
            hint="Apa saja yang benar-benar bisa dilakukan fasilitas ini. Pasien memakai info ini untuk memilih tujuan."
            error={errors.services ?? null}
            required
          >
            {() => (
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_OPTIONS.map((service) => (
                  <Checkbox
                    key={service}
                    label={facilityServiceLabel[service]}
                    checked={draft.services.includes(service)}
                    onChange={(checked) =>
                      setDraft((c) => ({
                        ...c,
                        services: checked
                          ? [...c.services, service]
                          : c.services.filter((item) => item !== service),
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </Field>

          <Field label="Kontak program TB" hint="Opsional. Kosongkan jika tidak ada program TB.">
            {({ id }) => (
              <TextInput
                id={id}
                value={draft.tbProgrammeContact ?? ''}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, tbProgrammeContact: event.target.value }))
                }
              />
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
