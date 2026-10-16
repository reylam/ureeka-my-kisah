import { useMemo, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  FileSearch,
  MessageSquarePlus,
  Phone,
  ScanLine,
  Send,
  UserRound,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import {
  FollowUpStatusBadge,
  ReferralPriorityBadge,
  ReferralStatusBadge,
  ScreeningOutcomeBadge,
  ScreeningStatusBadge,
} from '@/components/ui/StatusBadge';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/Inputs';
import { PatientTimeline } from '@/components/patients/PatientTimeline';
import { buildTimeline } from '@/components/patients/buildTimeline';
import { ReferralFormDialog } from '@/components/referrals/ReferralFormDialog';
import { FollowUpFormDialog } from '@/components/followups/FollowUpFormDialog';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { facilities } from '@/data/facilities';
import { users } from '@/data/users';
import {
  ageFromBirthDate,
  formatDate,
  formatDateTime,
  formatDueLabel,
} from '@/utils/date';
import {
  facilityServiceLabel,
  followUpReasonLabel,
  riskFactorLabel,
  sexLabel,
} from '@/utils/labels';
import { pluralise } from '@/utils/format';

/**
 * Patient record.
 *
 * Tabbed so the page does not dump every field at once: the overview answers
 * "who is this and what is outstanding", and the other tabs hold the detail.
 * The timeline is the default view because it is the fastest way to understand
 * a patient you have not met.
 */

type TabId = 'timeline' | 'screenings' | 'referrals' | 'followups' | 'details';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const patient = useDataStore((state) => state.patients.find((item) => item.id === patientId));
  // useShallow: these selectors build a new array on every call, which zustand 5
  // would otherwise treat as a changed snapshot and re-render forever.
  const screenings = useDataStore(
    useShallow((state) => state.screenings.filter((item) => item.patientId === patientId)),
  );
  const referrals = useDataStore(
    useShallow((state) => state.referrals.filter((item) => item.patientId === patientId)),
  );
  const followUps = useDataStore(
    useShallow((state) => state.followUps.filter((item) => item.patientId === patientId)),
  );
  const addPatientNote = useDataStore((state) => state.addPatientNote);
  const loadPatient = useDataStore((state) => state.loadPatient);

  // The list holds a summary; opening the record fetches the full one with its
  // notes. That read is audited by the server.
  useEffect(() => {
    if (patientId) void loadPatient(patientId).catch(() => undefined);
  }, [patientId, loadPatient]);

  const [tab, setTab] = useState<TabId>('timeline');
  const [referralOpen, setReferralOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const sortedScreenings = useMemo(
    () => [...screenings].sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    [screenings],
  );
  const sortedReferrals = useMemo(
    () => [...referrals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [referrals],
  );
  const sortedFollowUps = useMemo(
    () => [...followUps].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [followUps],
  );

  const timeline = useMemo(
    () => (patient ? buildTimeline(patient, screenings, referrals, followUps) : []),
    [patient, screenings, referrals, followUps],
  );

  if (!patient) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={<FileSearch />}
          title="Data pasien tidak ditemukan"
          description="Data ini mungkin tidak ada, atau pasien terdaftar di fasilitas yang bukan tempat tugasmu."
          action={
            <Button
              variant="primary"
              leadingIcon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/patients')}
            >
              Kembali ke daftar pasien
            </Button>
          }
        />
      </Card>
    );
  }

  const homeFacility = facilities.find((item) => item.id === patient.homeFacilityId);
  const openFollowUps = sortedFollowUps.filter(
    (item) => item.status === 'scheduled' || item.status === 'in-progress',
  );
  const latestScreening = sortedScreenings[0];

  const saveNote = async () => {
    if (noteBody.trim().length < 5) {
      setNoteError('Tulis minimal beberapa kata.');
      return;
    }
    try {
      await addPatientNote(patient.id, noteBody, 'general');
      setNoteBody('');
      setNoteError(null);
      setNoteOpen(false);
      toast.success('Catatan ditambahkan ke timeline pasien.');
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : 'Catatan gagal disimpan.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={patient.name}
        description={
          <>
            {ageFromBirthDate(patient.birthDate)} tahun · {sexLabel[patient.sex]} ·{' '}
            {patient.village}, {patient.district}
          </>
        }
        meta={
          <>
            <HeaderMeta label="No. rekam medis" value={<span className="font-mono">{patient.mrn}</span>} />
            <HeaderMeta label="Screening" value={screenings.length} />
            <HeaderMeta
              label="Telepon"
              value={
                patient.phone ? (
                  <a
                    href={`tel:${patient.phone.replace(/\s/g, '')}`}
                    className="inline-flex items-center gap-1 text-ct-700 underline decoration-ct-300 underline-offset-2"
                  >
                    <Phone aria-hidden className="size-3" />
                    {patient.phone}
                  </a>
                ) : (
                  <span className="text-attention-800">Belum ada</span>
                )
              }
            />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              leadingIcon={<MessageSquarePlus className="size-4" />}
              onClick={() => setNoteOpen(true)}
            >
              Tambah catatan
            </Button>
            <Button
              variant="outline"
              leadingIcon={<CalendarClock className="size-4" />}
              onClick={() => setFollowUpOpen(true)}
            >
              Jadwalkan follow-up
            </Button>
            <Button
              variant="outline"
              leadingIcon={<Send className="size-4" />}
              onClick={() => setReferralOpen(true)}
            >
              Buat referral
            </Button>
            <Button
              variant="primary"
              leadingIcon={<ScanLine className="size-4" />}
              onClick={() => navigate(`/screenings/new?patient=${patient.id}`)}
            >
              Screening baru
            </Button>
          </>
        }
      />

      {/* At-a-glance strip */}
      <div className="flex flex-wrap items-center gap-2">
        {latestScreening ? <ScreeningStatusBadge status={latestScreening.status} /> : null}
        {latestScreening?.analysis ? (
          <ScreeningOutcomeBadge outcome={latestScreening.analysis.outcome} />
        ) : null}
        {openFollowUps.length > 0 ? (
          <Badge tone="attention" icon={<CalendarClock />}>
            {pluralise(openFollowUps.length, 'follow-up aktif', 'follow-up aktif')}
          </Badge>
        ) : null}
        {patient.riskFactors.map((factor) => (
          <Badge key={factor} tone="neutral" size="sm" icon={<UserRound />}>
            {riskFactorLabel[factor]}
          </Badge>
        ))}
      </div>

      <Card className="overflow-hidden">
        <Tabs<TabId>
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { id: 'timeline', label: 'Timeline', count: timeline.length },
            { id: 'screenings', label: 'Screening', count: screenings.length },
            { id: 'referrals', label: 'Referral', count: referrals.length },
            {
              id: 'followups',
              label: 'Follow-up',
              count: followUps.length,
              countTone: openFollowUps.length > 0 ? 'attention' : 'neutral',
            },
            { id: 'details', label: 'Detail' },
          ]}
        />

        {tab === 'timeline' ? (
          <TabPanel id="timeline">
            <PatientTimeline entries={timeline} />
          </TabPanel>
        ) : null}

        {tab === 'screenings' ? (
          <TabPanel id="screenings">
            {sortedScreenings.length === 0 ? (
              <EmptyState
                compact
                icon={<ScanLine />}
                title="Belum ada screening tercatat"
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(`/screenings/new?patient=${patient.id}`)}
                  >
                    Catat screening pertama
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-obsidian-100">
                {sortedScreenings.map((screening) => (
                  <li key={screening.id}>
                    <Link
                      to={`/screenings/${screening.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ct-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-obsidian-900 tabular">
                          {formatDateTime(screening.performedAt)}
                        </p>
                        <p className="mt-1 text-xs text-obsidian-500">
                          {screening.symptoms.coughWeeks > 0
                            ? `Batuk ${screening.symptoms.coughWeeks} mgg`
                            : 'Tidak ada keluhan batuk'}
                          {' · '}
                          {users.find((u) => u.id === screening.operatorId)?.name ?? 'Tidak diketahui'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <ScreeningStatusBadge status={screening.status} size="sm" />
                          {screening.analysis ? (
                            <ScreeningOutcomeBadge
                              outcome={screening.analysis.outcome}
                              short
                              size="sm"
                            />
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-obsidian-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        ) : null}

        {tab === 'referrals' ? (
          <TabPanel id="referrals">
            {sortedReferrals.length === 0 ? (
              <EmptyState
                compact
                icon={<Send />}
                title="Belum ada referral"
                description="Referral meneruskan pasien ke fasilitas yang bisa mengonfirmasi atau menyingkirkan TB."
                action={
                  <Button size="sm" variant="primary" onClick={() => setReferralOpen(true)}>
                    Buat referral
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-obsidian-100">
                {sortedReferrals.map((referral) => {
                  const destination = facilities.find((f) => f.id === referral.toFacilityId);
                  return (
                    <li key={referral.id}>
                      <Link
                        to={`/referrals?focus=${referral.id}`}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ct-50/70"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-obsidian-900">
                            <span className="font-mono text-xs text-obsidian-600">
                              {referral.code}
                            </span>{' '}
                            → {destination?.name ?? 'Fasilitas tidak diketahui'}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-obsidian-500">
                            {facilityServiceLabel[referral.requestedService]} · dibuat{' '}
                            {formatDate(referral.createdAt)}
                            {referral.appointmentDate
                              ? ` · janji temu ${formatDate(referral.appointmentDate)}`
                              : ''}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <ReferralStatusBadge status={referral.status} size="sm" />
                            <ReferralPriorityBadge priority={referral.priority} size="sm" />
                          </div>
                        </div>
                        <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-obsidian-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabPanel>
        ) : null}

        {tab === 'followups' ? (
          <TabPanel id="followups">
            {sortedFollowUps.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarClock />}
                title="Belum ada follow-up terjadwal"
                action={
                  <Button size="sm" variant="primary" onClick={() => setFollowUpOpen(true)}>
                    Jadwalkan follow-up
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-obsidian-100">
                {sortedFollowUps.map((followUp) => (
                  <li key={followUp.id}>
                    <Link
                      to={`/followups?focus=${followUp.id}`}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ct-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-obsidian-900">
                          {followUpReasonLabel[followUp.reason]}
                        </p>
                        <p className="mt-1 text-xs text-obsidian-500">
                          <span className="font-mono">{followUp.code}</span> ·{' '}
                          {followUp.status === 'completed'
                            ? `selesai ${followUp.completedAt ? formatDate(followUp.completedAt) : ''}`
                            : formatDueLabel(followUp.dueDate)}
                          {followUp.attempts.length > 0
                            ? ` · ${pluralise(followUp.attempts.length, 'percobaan kontak', 'percobaan kontak')}`
                            : ''}
                        </p>
                        {followUp.unresolvedReason ? (
                          <p className="mt-1 text-xs leading-relaxed text-urgent-700">
                            {followUp.unresolvedReason}
                          </p>
                        ) : null}
                        <div className="mt-2">
                          <FollowUpStatusBadge status={followUp.status} size="sm" />
                        </div>
                      </div>
                      <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-obsidian-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        ) : null}

        {tab === 'details' ? (
          <TabPanel id="details">
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <section>
                <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  Identitas
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Nama lengkap">{patient.name}</DetailRow>
                  <DetailRow label="No. rekam medis">
                    <span className="font-mono text-xs">{patient.mrn}</span>
                  </DetailRow>
                  <DetailRow label="Tanggal lahir">
                    {formatDate(patient.birthDate)}{' '}
                    <span className="text-obsidian-400">
                      ({ageFromBirthDate(patient.birthDate)} thn)
                    </span>
                  </DetailRow>
                  <DetailRow label="Jenis kelamin">{sexLabel[patient.sex]}</DetailRow>
                  <DetailRow label="Terdaftar">{formatDate(patient.registeredAt)}</DetailRow>
                </dl>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  Lokasi &amp; kontak
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Desa">{patient.village}</DetailRow>
                  <DetailRow label="Kecamatan">{patient.district}</DetailRow>
                  <DetailRow label="Provinsi">{patient.province}</DetailRow>
                  <DetailRow label="Telepon">{patient.phone ?? 'Belum ada'}</DetailRow>
                  <DetailRow label="Fasilitas asal">{homeFacility?.name ?? 'Belum dicatat'}</DetailRow>
                </dl>
              </section>

              <section className="lg:col-span-2">
                <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  Konteks epidemiologi
                </h3>
                <dl className="mt-2 divide-y divide-obsidian-100">
                  <DetailRow label="Faktor risiko">
                    {patient.riskFactors.length === 0
                      ? 'Belum ada yang dicatat'
                      : patient.riskFactors.map((factor) => riskFactorLabel[factor]).join(', ')}
                  </DetailRow>
                  <DetailRow label="Kontak serumah">
                    {patient.householdContacts === 0
                      ? 'Belum ada yang dicatat'
                      : pluralise(patient.householdContacts, 'orang', 'orang')}
                  </DetailRow>
                </dl>
              </section>

              <section className="lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                    Catatan ({patient.notes.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    leadingIcon={<MessageSquarePlus className="size-3.5" />}
                    onClick={() => setNoteOpen(true)}
                  >
                    Tambah catatan
                  </Button>
                </div>
                {patient.notes.length === 0 ? (
                  <p className="mt-2 text-[13px] text-obsidian-500">Belum ada catatan di record ini.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {patient.notes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded-md border border-obsidian-200 bg-obsidian-50/60 px-3 py-2.5"
                      >
                        <p className="text-[13px] leading-relaxed text-obsidian-800">{note.body}</p>
                        <p className="mt-1.5 text-[11px] text-obsidian-400">
                          {users.find((u) => u.id === note.authorId)?.name ?? 'Tidak diketahui'} ·{' '}
                          {formatDateTime(note.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </TabPanel>
        ) : null}
      </Card>

      {/* Dialogs */}
      <ReferralFormDialog
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        patientId={patient.id}
        screeningId={latestScreening?.id ?? null}
      />
      <FollowUpFormDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        patientId={patient.id}
        screeningId={latestScreening?.id ?? null}
        referralId={sortedReferrals[0]?.id ?? null}
      />
      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Tambah catatan"
        description={`Ditambahkan ke timeline ${patient.name}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={saveNote}>
              Simpan catatan
            </Button>
          </>
        }
      >
        <Field label="Catatan" error={noteError} required>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              describedBy={describedBy}
              invalid={invalid}
              rows={4}
              placeholder="Apa pun yang perlu diketahui petugas berikutnya yang mengunjungi pasien ini."
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
