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
import { useAccountStore } from '@/stores/accountStore';
import { useCurrentAccount } from '@/stores/authStore';
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
  const actor = useCurrentAccount();
  const facilities = useFacilityStore((state) => state.facilities);
  const createFacility = useFacilityStore((state) => state.create);
  const updateFacility = useFacilityStore((state) => state.update);
  const setPublished = useFacilityStore((state) => state.setPublished);
  const log = useAccountStore((state) => state.log);

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
    if (draft.name.trim().length < 3) next.name = 'Enter the facility name.';
    if (!draft.region.trim()) next.region = 'Choose the district.';
    if (!draft.address.trim()) next.address = 'Enter an address.';
    if (draft.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a contact number.';
    if (draft.services.length === 0) next.services = 'Select at least one service.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => {
    if (!actor || !validate()) return;

    if (editing) {
      updateFacility(editing.id, draft);
      log(actor, 'facility.updated', draft.name.trim());
      toast.success('Facility updated.', 'Marked as needing review again.');
      setEditing(null);
      return;
    }

    const created = createFacility(draft);
    log(actor, 'facility.created', created.name, 'Created unpublished.');
    toast.success('Facility added.', 'Publish it once the details have been checked.');
    setCreating(false);
  };

  const togglePublished = (facility: ManagedFacility) => {
    if (!actor) return;
    const next = !facility.published;
    setPublished(facility.id, next);
    log(actor, next ? 'facility.published' : 'facility.unpublished', facility.name);
    toast.success(next ? 'Published to the directory.' : 'Removed from the directory.');
  };

  const columns: Column<ManagedFacility>[] = [
    {
      id: 'name',
      header: 'Facility',
      cell: (facility) => (
        <StackedCell
          primary={facility.name}
          secondary={`${facilityTypeLabel[facility.type]} · ${facility.region}`}
        />
      ),
    },
    {
      id: 'services',
      header: 'Services',
      hideBelow: 'lg',
      cell: (facility) => (
        <span className="text-obsidian-600">
          {facility.services.length === 0
            ? 'None recorded'
            : facility.services.map((service) => facilityServiceLabel[service]).join(', ')}
        </span>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      hideBelow: 'md',
      cell: (facility) => (
        <StackedCell primary={facility.phone} secondary={facility.operatingHours || undefined} />
      ),
    },
    {
      id: 'info',
      header: 'Record',
      hideBelow: 'md',
      cell: (facility) => (
        <StackedCell
          primary={<FacilityInfoBadge status={facility.infoStatus} size="sm" />}
          secondary={`Updated ${formatDate(facility.infoUpdatedAt)}`}
        />
      ),
    },
    {
      id: 'published',
      header: 'Directory',
      cell: (facility) =>
        facility.published ? (
          <Badge tone="complete" size="sm" icon={<Eye />}>
            Public
          </Badge>
        ) : (
          <Badge tone="inert" size="sm" icon={<EyeOff />}>
            Hidden
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Actions',
      align: 'right',
      cell: (facility) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Pencil className="size-3.5" />}
            onClick={() => openEdit(facility)}
          >
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => togglePublished(facility)}>
            {facility.published ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      ),
    },
  ];

  const dialogOpen = creating || Boolean(editing);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facilities"
        description="Hospitals, puskesmas and labs. Published entries appear in the public directory."
        actions={
          <Button variant="primary" leadingIcon={<Plus className="size-4" />} onClick={openCreate}>
            Add facility
          </Button>
        }
      />

      <Notice tone="info" compact>
        New entries start hidden. Check the address, phone number and services, then publish, so
        nobody is sent to a facility that cannot run the test they need.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} of ${facilities.length} facilities`}
          icon={<Building2 />}
          actions={
            <SearchInput
              label="Search facilities"
              value={query}
              onChange={setQuery}
              placeholder="Name or district"
            />
          }
        />
        <CardBody padded={false}>
          {rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState entity="facilities" onClear={() => setQuery('')} />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(facility) => facility.id}
              caption="Healthcare facilities in the directory"
              renderMobileCard={(facility) => (
                <div className="space-y-2">
                  <StackedCell
                    primary={facility.name}
                    secondary={`${facilityTypeLabel[facility.type]} · ${facility.region}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {facility.published ? (
                      <Badge tone="complete" size="sm" icon={<Eye />}>
                        Public
                      </Badge>
                    ) : (
                      <Badge tone="inert" size="sm" icon={<EyeOff />}>
                        Hidden
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
        title={editing ? 'Edit facility' : 'Add facility'}
        description={
          editing
            ? 'Saving marks the record as needing review again.'
            : 'The entry is created hidden until you publish it.'
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
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              {editing ? 'Save changes' : 'Add facility'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Facility name" error={errors.name ?? null} required>
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
            <Field label="Type" required>
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

            <Field label="District" error={errors.region ?? null} required>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  value={draft.region}
                  onChange={(event) => setDraft((c) => ({ ...c, region: event.target.value }))}
                  describedBy={describedBy}
                  invalid={invalid}
                >
                  <option value="">Choose a district</option>
                  {DISTRICTS.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Address" error={errors.address ?? null} required>
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
            <Field label="Phone" error={errors.phone ?? null} required>
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

            <Field label="Opening hours" hint="For example: Mon to Fri, 08:00 to 14:00">
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
            label="Services available"
            hint="What this facility can actually do. Patients use this to decide where to go."
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

          <Field label="TB programme contact" hint="Optional. Leave blank if there is no TB programme.">
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
