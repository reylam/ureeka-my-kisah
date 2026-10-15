import { useCallback, useEffect, useRef, useState } from 'react';
import { scenarioForKey, type DemoScenario } from '@/trace/data/demoResults';
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
 * The error state is still part of the machine, and `InferenceStatus` renders
 * it, so a real transport failure has somewhere to land once this is pointed
 * at a service. It is simply not reachable from the interface today.
 */

export type InferenceState = 'idle' | 'ready' | 'running' | 'done' | 'error';

export interface InferenceStage {
  id: string;
  label: string;
  detail: string;
}

export const STAGES: InferenceStage[] = [
  { id: 'validate', label: 'Checking the file', detail: 'Type, size and dimensions of the image' },
  {
    id: 'preprocess',
    label: 'Preparing the picture',
    detail: 'Would resize and even out the brightness before anything looks at it',
  },
  {
    id: 'infer',
    label: 'Looking for patterns',
    detail: 'Not happening: no trained model is connected, so a stand-in is used',
  },
  { id: 'report', label: 'Writing up the result', detail: 'The answer, with its warnings' },
];

interface UseSimulatedInference {
  state: InferenceState;
  /** 0–1 across all stages. */
  progress: number;
  stageIndex: number;
  result: DemoScenario | null;
  errorMessage: string | null;
  run: (key: string) => void;
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

  const progress =
    state === 'done' ? 1 : state === 'running' ? stageIndex / STAGES.length : 0;

  return { state, progress, stageIndex, result, errorMessage, run, reset };
}
