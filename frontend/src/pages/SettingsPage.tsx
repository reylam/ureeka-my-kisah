import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Database,
  FlaskConical,
  HardDrive,
  Image as ImageIcon,
  LogOut,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserCog,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Toggle } from '@/components/forms/Inputs';
import { FacilityInfoBadge } from '@/components/ui/StatusBadge';
import { useAuthStore, useCurrentUser } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { clearImages, getStorageUsage } from '@/services/imageStore';
import { unregisterServiceWorker } from '@/utils/registerServiceWorker';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';
import { DEMO_MODEL } from '@/data/model';
import { facilityServiceLabel, facilityTypeLabel, userRoleLabel } from '@/utils/labels';
import { formatBytes, pluralise } from '@/utils/format';
import { formatDate } from '@/utils/date';

/**
 * Settings.
 *
 * Only contains controls that genuinely do something. There is no remote
 * profile to update and no appearance engine to configure, so rather than
 * shipping switches that write to nothing, this page explains the environment
 * and offers the two actions that have real effects: clearing stored images and
 * resetting the demo dataset.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const signOut = useAuthStore((state) => state.signOut);

  const simulatedOffline = useConnectionStore((state) => state.simulatedOffline);
  const setSimulatedOffline = useConnectionStore((state) => state.setSimulatedOffline);

  const resetDemoData = useDataStore((state) => state.resetDemoData);
  const patients = useDataStore((state) => state.patients);
  const screenings = useDataStore((state) => state.screenings);
  const referrals = useDataStore((state) => state.referrals);
  const followUps = useDataStore((state) => state.followUps);

  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearImagesOpen, setClearImagesOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const refreshUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      setUsage(await getStorageUsage());
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const facility = facilities.find((item) => item.id === OPERATING_FACILITY_ID);

  /** Rough size of the persisted record metadata in localStorage. */
  const metadataBytes = (() => {
    try {
      return new Blob([window.localStorage.getItem('sentratb.data.v1') ?? '']).size;
    } catch {
      return 0;
    }
  })();

  const handleReset = async () => {
    setWorking(true);
    try {
      await resetDemoData();
      await unregisterServiceWorker();
      await refreshUsage();
      toast.success(
        'Demo data reset.',
        'Records, radiographs and the cached app shell were cleared.',
      );
      setResetOpen(false);
      navigate('/dashboard');
    } finally {
      setWorking(false);
    }
  };

  const handleClearImages = async () => {
    setWorking(true);
    try {
      await clearImages();
      // Screening records keep their metadata but lose the stored image.
      useDataStore.getState().screenings.forEach((screening) => {
        if (screening.imageKey) {
          useDataStore.getState().updateScreening(screening.id, { imageKey: null });
        }
      });
      await refreshUsage();
      toast.success('Stored radiographs cleared.', 'Screening records were kept.');
      setClearImagesOpen(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Settings"
        description="Your profile, this facility, and the demo data stored on this device."
      />

      {/* Profile */}
      <Card>
        <CardHeader icon={<UserCog />} title="Profile" />
        <CardBody className="space-y-4">
          {user ? (
            <div className="flex items-start gap-3">
              <Avatar name={user.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-obsidian-950">{user.name}</p>
                <p className="mt-0.5 text-[13px] text-obsidian-500">{userRoleLabel[user.role]}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.canReview ? (
                    <Badge tone="complete" size="sm" icon={<FlaskConical />}>
                      Can sign off reviews
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm" icon={<FlaskConical />}>
                      Cannot sign off reviews
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                leadingIcon={<LogOut className="size-4" />}
                onClick={() => {
                  signOut();
                  navigate('/login', { replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          ) : null}

          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Email">{user?.email ?? 'Not signed in'}</DetailRow>
            <DetailRow label="Phone">{user?.phone ?? 'None on file'}</DetailRow>
          </dl>

          <Notice tone="demo" compact>
            Profile details come from the local dataset. Editing them here would not reach any
            remote system, so the fields are read-only.
          </Notice>
        </CardBody>
      </Card>

      {/* Facility */}
      <Card>
        <CardHeader
          icon={<Building2 />}
          title="Facility"
          description="The facility this prototype is operating as."
        />
        <CardBody>
          {facility ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-obsidian-950">{facility.name}</p>
                <Badge tone="neutral" size="sm" icon={<Building2 />}>
                  {facilityTypeLabel[facility.type]}
                </Badge>
                <FacilityInfoBadge status={facility.infoStatus} size="sm" />
              </div>
              <dl className="mt-3 divide-y divide-obsidian-100">
                <DetailRow label="Address">{facility.address}</DetailRow>
                <DetailRow label="Region">
                  {facility.region}, {facility.province}
                </DetailRow>
                <DetailRow label="Phone">{facility.phone}</DetailRow>
                <DetailRow label="Opening hours">{facility.operatingHours}</DetailRow>
                <DetailRow label="On-site services">
                  {facility.services.map((service) => facilityServiceLabel[service]).join(', ')}
                </DetailRow>
                <DetailRow label="TB programme contact">
                  {facility.tbProgrammeContact ?? 'No named contact'}
                </DetailRow>
                <DetailRow label="Entry last checked">
                  {formatDate(facility.infoUpdatedAt)}
                </DetailRow>
              </dl>
            </>
          ) : null}
        </CardBody>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader
          icon={<FlaskConical />}
          title="Prototype environment"
          description="What is running, and what is not."
        />
        <CardBody className="space-y-4">
          <dl className="divide-y divide-obsidian-100">
            <DetailRow label="Screening output">
              {DEMO_MODEL.name}
              <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                {DEMO_MODEL.version}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-obsidian-500">
                No trained model is loaded. Output is generated locally from the symptom data and
                image-quality rating entered during screening.
              </span>
            </DetailRow>
            <DetailRow label="Label set">{DEMO_MODEL.labels.join(', ')}</DetailRow>
            <DetailRow label="Reported performance">
              <span className="text-obsidian-500">
                None. Nothing here has been evaluated, so no accuracy figures are shown anywhere in
                the product.
              </span>
            </DetailRow>
            <DetailRow label="Authentication">
              <span className="text-obsidian-500">
                Checked on this device only. No authentication server is involved.
              </span>
            </DetailRow>
          </dl>

          <div className="rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
            <Toggle
              tone="attention"
              checked={simulatedOffline}
              onChange={(value) => {
                setSimulatedOffline(value);
                toast.info(value ? 'Offline mode simulated.' : 'Offline simulation switched off.');
              }}
              label="Work offline"
              description="Forces the offline behaviour without disconnecting the network."
            />
          </div>

          <Notice tone="info" compact>
            Animations follow your operating system&rsquo;s reduced-motion setting, and the mock
            service layer skips its artificial delays when that is enabled.
          </Notice>
        </CardBody>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader
          icon={<HardDrive />}
          title="Storage on this device"
          description="Where the demo records live and how much space they take."
          actions={
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<RefreshCw className="size-3.5" />}
              onClick={() => void refreshUsage()}
              loading={usageLoading}
            >
              Recheck
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-obsidian-200 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <ImageIcon aria-hidden className="size-3" />
                Radiographs (IndexedDB)
              </p>
              <p className="mt-2 text-lg leading-none font-semibold text-obsidian-950 tabular">
                {usageLoading ? 'â€¦' : usage ? formatBytes(usage.bytes) : 'Unavailable'}
              </p>
              <p className="mt-1.5 text-xs text-obsidian-500">
                {usageLoading
                  ? 'Checking'
                  : usage
                    ? `${pluralise(usage.count, 'image')} stored`
                    : 'Could not read the image store'}
              </p>
            </div>

            <div className="rounded-md border border-obsidian-200 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <Database aria-hidden className="size-3" />
                Record metadata (localStorage)
              </p>
              <p className="mt-2 text-lg leading-none font-semibold text-obsidian-950 tabular">
                {formatBytes(metadataBytes)}
              </p>
              <p className="mt-1.5 text-xs text-obsidian-500">
                {patients.length} patients · {screenings.length} screenings · {referrals.length}{' '}
                referrals · {followUps.length} follow-ups
              </p>
            </div>
          </div>

          <Notice tone="demo" compact>
            Radiographs are kept out of localStorage and out of the service-worker cache on
            purpose. Browser storage is not equivalent to a secured backend.
          </Notice>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leadingIcon={<ImageIcon className="size-4" />}
              onClick={() => setClearImagesOpen(true)}
              disabled={!usage || usage.count === 0}
            >
              Clear stored radiographs
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Reset */}
      <Card className="border-urgent-300/70">
        <CardHeader
          icon={<RotateCcw />}
          title="Reset all records"
          description="Restores the starting dataset and removes everything created since."
        />
        <CardBody className="space-y-3">
          <p className="text-[13px] leading-relaxed text-obsidian-600">
            This rebuilds the original patients, screenings, referrals and follow-ups, deletes every
            uploaded radiograph from this device, and drops the cached application shell. Useful
            before a fresh walkthrough.
          </p>
          <Button
            variant="danger"
            leadingIcon={<Trash2 className="size-4" />}
            onClick={() => setResetOpen(true)}
          >
            Reset all records
          </Button>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void handleReset()}
        tone="danger"
        loading={working}
        title="Reset all demo data?"
        description="Every record you have created or edited will be replaced by the original seeded dataset, and stored radiographs will be deleted. This cannot be undone."
        confirmLabel="Reset everything"
      />

      <ConfirmDialog
        open={clearImagesOpen}
        onClose={() => setClearImagesOpen(false)}
        onConfirm={() => void handleClearImages()}
        tone="danger"
        loading={working}
        title="Clear stored radiographs?"
        description="Uploaded images will be deleted from this device. Screening records stay, but they will no longer have an image to display."
        confirmLabel="Clear images"
      />
    </div>
  );
}
