import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_SCENARIOS, scenarioForKey, type DemoScenario } from '@/trace/data/demoResults';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * The demo's state machine.
 *
 * There is no model, so there is nothing to await. What the machine does is
 * step through the stages a real inference call would pass through, which is
 * the part worth reviewing: the states a user can land in, and what each one
 * says. The stage labels describe work that is *not* happening, so they are
 * phrased as "would preprocess", and the panel header says "simulated".
 *
 * The failure path is reachable on purpose, through `simulateFailure`, which
 * the demo exposes as a visible control. An interface whose error state has
 * never been looked at has not been reviewed.
 */

export type InferenceState = 'idle' | 'ready' | 'running' | 'done' | 'error';

export interface InferenceStage {
  id: string;
  label: string;
  detail: string;
}

export const STAGES: InferenceStage[] = [
  { id: 'validate', label: 'Validating input', detail: 'File type, size and pixel dimensions' },
  {
    id: 'preprocess',
    label: 'Preprocessing (simulated)',
    detail: 'Would resize and normalise to the model input specification',
  },
  {
    id: 'infer',
    label: 'Inference (simulated)',
    detail: 'No model is loaded — a placeholder is selected instead',
  },
  { id: 'report', label: 'Assembling report', detail: 'Output, disclosures and limitations' },
];

interface UseSimulatedInference {
  state: InferenceState;
  /** 0–1 across all stages. */
  progress: number;
  stageIndex: number;
  result: DemoScenario | null;
  errorMessage: string | null;
  run: (key: string) => void;
  simulateFailure: () => void;
  reset: () => void;
}

/** Per-stage dwell time. Short enough not to waste a reviewer's time. */
const STAGE_MS = 420;

export function useSimulatedInference(): UseSimulatedInference {
  const [state, setState] = useState<InferenceState>('idle');
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<DemoScenario | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState('idle');
    setStageIndex(0);
    setResult(null);
    setErrorMessage(null);
  }, [clearTimers]);

  const run = useCallback(
    (key: string) => {
      clearTimers();
      setErrorMessage(null);
      setResult(null);
      setStageIndex(0);
      setState('running');

      const step = prefersReducedMotion ? 60 : STAGE_MS;
      const scenario = scenarioForKey(key);

      STAGES.forEach((_stage, index) => {
        if (index === 0) return;
        timers.current.push(
          window.setTimeout(() => setStageIndex(index), step * index),
        );
      });

      timers.current.push(
        window.setTimeout(() => {
          setStageIndex(STAGES.length);
          setResult(scenario);
          setState('done');
        }, step * STAGES.length),
      );
    },
    [clearTimers, prefersReducedMotion],
  );

  /**
   * Walks into the failure state so it can be inspected. A real client would
   * land here on a network error, a rejected upload or a model-server timeout.
   */
  const simulateFailure = useCallback(() => {
    clearTimers();
    setResult(null);
    setStageIndex(1);
    setState('running');
    const step = prefersReducedMotion ? 60 : STAGE_MS;
    timers.current.push(
      window.setTimeout(() => {
        setState('error');
        setErrorMessage(
          'The inference request did not complete. In this build there is no inference service to reach, so this is a deliberate demonstration of the failure state rather than a real fault.',
        );
      }, step * 2),
    );
  }, [clearTimers, prefersReducedMotion]);

  const progress =
    state === 'done' ? 1 : state === 'running' ? stageIndex / STAGES.length : 0;

  return { state, progress, stageIndex, result, errorMessage, run, simulateFailure, reset };
}

/** Exposed for the "how many placeholder outcomes exist" disclosure. */
export const SCENARIO_COUNT = DEMO_SCENARIOS.length;
