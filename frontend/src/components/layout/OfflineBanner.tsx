import { Link } from 'react-router-dom';
import { CloudOff, WifiOff } from 'lucide-react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useDataStore } from '@/stores/dataStore';
import { pluralise } from '@/utils/format';

/**
 * Persistent banner shown while the app is offline.
 *
 * It states exactly which capabilities still work and which do not, rather than
 * a vague "you are offline" message. Screening analysis genuinely cannot run
 * against a remote model without a connection, and pretending otherwise would
 * be the single most misleading thing this prototype could do.
 */
export function OfflineBanner() {
  const online = useConnectionStore((state) => state.online);
  const simulated = useConnectionStore((state) => state.simulatedOffline);
  const queued = useDataStore(
    (state) => state.syncQueue.filter((item) => item.state !== 'synced').length,
  );

  if (online && !simulated) return null;

  return (
    <div
      role="status"
      data-print="hide"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-attention-300 bg-attention-50 px-3 py-2 text-[13px] text-attention-800 sm:px-5 lg:px-7"
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <WifiOff aria-hidden className="size-4 shrink-0" />
        {simulated && online ? 'Offline mode (simulated)' : 'No connection'}
      </span>
      <span className="text-attention-700">
        Screening forms, drafts and record edits keep working and are saved on this device. Image
        analysis needs a connection.
      </span>
      {queued > 0 ? (
        <Link
          to="/offline"
          className="inline-flex items-center gap-1.5 font-medium text-attention-800 underline decoration-attention-400 underline-offset-2 transition-colors hover:text-attention-900"
        >
          <CloudOff aria-hidden className="size-3.5" />
          {pluralise(queued, 'record')} waiting
        </Link>
      ) : null}
    </div>
  );
}
