import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, request } from '@/lib/apiClient';
import type { ScreeningAnalysis } from '@/types/domain';
import type { DemoScenario } from '@/trace/data/demoResults';
import type { SelectedImage } from './useImageUpload';
import {
  STAGES as SIMULATED_STAGES,
  useSimulatedInference,
  type InferenceStage,
  type InferenceState,
} from './useSimulatedInference';

/**
 * The demo's run state, for both ways it can answer.
 *
 * With the screening model connected (`live`), the image is posted to the API,
 * which hands it to the model and returns the analysis. Without it, the page
 * falls back to the stand-in used before a model existed: nothing is sent
 * anywhere and the result is picked from the file's details. Which of the two
 * is in use is decided by the caller from the API's own health report, never
 * assumed, and the page's wording follows it.
 *
 * Both paths share one state machine so the status panel and the page do not
 * need to know which is running.
 */

export const LIVE_STAGES: InferenceStage[] = [
  {
    id: 'validate',
    label: 'Memeriksa file',
    detail: 'Tipe, ukuran, dan dimensi gambar, diperiksa di browser kamu',
  },
  {
    id: 'analyse',
    label: 'Dibaca oleh model',
    detail:
      'Gambar dikirim ke server situs ini dan dibaca model terlatih. Hanya ditahan di memori untuk satu permintaan ini, tidak disimpan',
  },
  {
    id: 'report',
    label: 'Menyusun hasil',
    detail: 'Tiga score kelas, satu risk point, dan peringatan yang menyertainya',
  },
];

export interface DemoInference {
  mode: 'live' | 'simulated';
  state: InferenceState;
  /** 0 to 1 across the stages of the active mode. */
  progress: number;
  stageIndex: number;
  stages: InferenceStage[];
  /** Set when a model produced the answer. */
  analysis: ScreeningAnalysis | null;
  /** Set when the stand-in produced the answer. */
  scenario: DemoScenario | null;
  errorMessage: string | null;
  run: (image: SelectedImage) => void;
  reset: () => void;
}

function describeFailure(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return 'Server tidak bisa dihubungi. Periksa koneksi kamu lalu coba lagi.';
    if (cause.status === 503) return 'Model screening sedang tidak tersambung ke server.';
    if (cause.status === 413) return 'Gambar terlalu besar untuk dikirim.';
    return cause.message;
  }
  return 'Terjadi kesalahan saat menganalisis gambar. Coba lagi.';
}

export function useDemoInference(live: boolean): DemoInference {
  const simulated = useSimulatedInference();

  const [liveState, setLiveState] = useState<InferenceState>('idle');
  const [liveStage, setLiveStage] = useState(0);
  const [analysis, setAnalysis] = useState<ScreeningAnalysis | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  // Leaving the page while a request is in flight should not set state later.
  useEffect(() => cancel, [cancel]);

  const { reset: resetSimulated, run: runSimulated } = simulated;

  const reset = useCallback(() => {
    cancel();
    resetSimulated();
    setLiveState('idle');
    setLiveStage(0);
    setAnalysis(null);
    setLiveError(null);
  }, [cancel, resetSimulated]);

  const run = useCallback(
    (image: SelectedImage) => {
      if (!live) {
        runSimulated(image.key);
        return;
      }

      cancel();
      const mine = new AbortController();
      controller.current = mine;

      setAnalysis(null);
      setLiveError(null);
      setLiveStage(1);
      setLiveState('running');

      const form = new FormData();
      form.append('image', image.file);

      request<ScreeningAnalysis>('POST', '/demo/analyze', { form, signal: mine.signal })
        .then(({ data }) => {
          if (mine.signal.aborted) return;
          setAnalysis(data);
          setLiveStage(LIVE_STAGES.length);
          setLiveState('done');
        })
        .catch((cause: unknown) => {
          if (mine.signal.aborted) return;
          setLiveError(describeFailure(cause));
          setLiveState('error');
        });
    },
    [live, cancel, runSimulated],
  );

  if (!live) {
    return {
      mode: 'simulated',
      state: simulated.state,
      progress: simulated.progress,
      stageIndex: simulated.stageIndex,
      stages: SIMULATED_STAGES,
      analysis: null,
      scenario: simulated.result,
      errorMessage: simulated.errorMessage,
      run,
      reset,
    };
  }

  return {
    mode: 'live',
    state: liveState,
    progress: liveState === 'done' ? 1 : liveState === 'running' ? liveStage / LIVE_STAGES.length : 0,
    stageIndex: liveStage,
    stages: LIVE_STAGES,
    analysis,
    scenario: null,
    errorMessage: liveError,
    run,
    reset,
  };
}
