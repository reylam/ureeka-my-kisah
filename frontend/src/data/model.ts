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
  name: 'Demo screening simulator',
  version: 'demo-0.1.0',
  backbone: 'densenet121 (label set mirrored from tb-train)',
  labels: ['Healthy', 'Sick-non-TB', 'TB'],
  validation: null,
};

/** Shown wherever analysis output appears. Kept to one short, unambiguous line. */
export const SIMULATED_RESULT_NOTICE = 'Simulated AI result, for demonstration only.';
