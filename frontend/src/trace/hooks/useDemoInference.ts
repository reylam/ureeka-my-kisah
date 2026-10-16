import { useCallback, useEffect, useRef, useState } from 'react';
import { analyseImageLocally } from '@/services/localModel';
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
 * Where the browser can run the screening model (`live`), the image is read by
 * the model right here: ONNX Runtime Web, in this tab, with no upload. Where it
 * cannot (no WebAssembly), the page falls back to the stand-in used before a
 * model existed, which picks a result from the file's details. The caller
 * decides which from `localModelSupported()`, and the page's wording follows.
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
      'Model berjalan di browser kamu, gambar tidak dikirim ke mana pun. Pertama kali dipakai, file model (sekitar 6 MB) diunduh dulu',
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
  /** Set when the model produced the answer. */
  analysis: ScreeningAnalysis | null;
  /** Set when the stand-in produced the answer. */
  scenario: DemoScenario | null;
  errorMessage: string | null;
  run: (image: SelectedImage) => void;
  reset: () => void;
}

function describeFailure(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return 'Terjadi kesalahan saat menganalisis gambar. Coba lagi.';
}

export function useDemoInference(live: boolean): DemoInference {
  const simulated = useSimulatedInference();

  const [liveState, setLiveState] = useState<InferenceState>('idle');
  const [liveStage, setLiveStage] = useState(0);
  const [analysis, setAnalysis] = useState<ScreeningAnalysis | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  // Bumped on reset and on every new run. A run that finishes after that must
  // not write its answer under a different picture.
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const { reset: resetSimulated, run: runSimulated } = simulated;

  const reset = useCallback(() => {
    generation.current += 1;
    resetSimulated();
    setLiveState('idle');
    setLiveStage(0);
    setAnalysis(null);
    setLiveError(null);
  }, [resetSimulated]);

  const run = useCallback(
    (image: SelectedImage) => {
      if (!live) {
        runSimulated(image.key);
        return;
      }

      generation.current += 1;
      const mine = generation.current;

      setAnalysis(null);
      setLiveError(null);
      setLiveStage(1);
      setLiveState('running');

      analyseImageLocally(image.file)
        .then((result) => {
          if (generation.current !== mine) return;
          setAnalysis(result);
          setLiveStage(LIVE_STAGES.length);
          setLiveState('done');
        })
        .catch((cause: unknown) => {
          if (generation.current !== mine) return;
          setLiveError(describeFailure(cause));
          setLiveState('error');
        });
    },
    [live, runSimulated],
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
