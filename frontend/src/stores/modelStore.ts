import { create } from 'zustand';
import { api } from '@/lib/apiClient';
import { onSessionReset } from '@/lib/sessionReset';
import { localModelSupported } from '@/services/localModel';

/**
 * Whether a screening model is available.
 *
 * The notices that sit next to model output say different things depending on
 * this. The model counts as available when the server has one (`GET /health`)
 * or when this browser can run it itself (`services/localModel.ts`), which is
 * the case in any browser with WebAssembly. `null` means "not known yet", and
 * is treated as not connected: the cautious reading.
 */
interface ModelState {
  connected: boolean | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useModelStore = create<ModelState>()((set) => ({
  connected: null,
  load: async () => {
    if (localModelSupported()) {
      set({ connected: true });
      return;
    }
    try {
      const health = await api.get<{ modelConnected?: boolean }>('/health');
      set({ connected: health.modelConnected === true });
    } catch {
      set({ connected: false });
    }
  },
  reset: () => set({ connected: null }),
}));

onSessionReset(() => useModelStore.getState().reset());

export const useModelConnected = (): boolean => useModelStore((state) => state.connected === true);
