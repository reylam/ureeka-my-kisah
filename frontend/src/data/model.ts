import type { ModelDescriptor } from '@/types/domain';

/**
 * Descriptor for the screening model.
 *
 * The label set and backbone mirror the sibling training project
 * (`tb-train`), which trains a DenseNet121 classifier over three classes
 * discovered from the TBX11K dataset, plus a Faster R-CNN lesion detector.
 *
 * `validation` is deliberately null. No accuracy, sensitivity or specificity
 * figures are shown anywhere in this prototype, because the output you see in
 * the UI comes from a built-in simulator rather than a trained model, so
 * reporting metrics for it would be fabrication.
 */
export const DEMO_MODEL: ModelDescriptor = {
  name: 'PULMO screening model',
  version: 'not yet connected',
  backbone: 'densenet121 (label set mirrored from tb-train)',
  labels: ['Healthy', 'Sick-non-TB', 'TB'],
  validation: null,
};

/**
 * Shown wherever analysis output appears.
 *
 * Reworded away from "simulated, for demonstration only", which read as though
 * the whole product were a toy. What it must not lose is the fact underneath:
 * no model is connected to this build, so the output beside this line was not
 * computed from the image. Dropping that would mean presenting an invented TB
 * classification as a real one.
 *
 * When a real inference service is connected, the notices switch to
 * `MODEL_RESULT_NOTICE` (see `components/ui/Notice.tsx`).
 */
export const SIMULATED_RESULT_NOTICE =
  'The screening model is not connected, so no model output is shown.';

/** Shown instead once a model is connected: model output is a screening aid only. */
export const MODEL_RESULT_NOTICE = 'Screening aid, not a diagnosis.';
