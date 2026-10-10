import {
  PURPOSE_OPTIONS,
  getPurposeColor,
  getPurposeLabel,
} from './treatmentLabResultConstants';
import type { PurposeConfig } from '../types/encounterLinks';

/**
 * Why a lab result is linked to a treatment, procedure or condition: baseline,
 * monitoring, outcome, safety or other. The backend accepts the same values for all
 * three (app/core/constants.py).
 */
export const LAB_RESULT_LINK_PURPOSES: PurposeConfig = {
  options: PURPOSE_OPTIONS,
  getLabel: getPurposeLabel,
  getColor: getPurposeColor,
};

/** The links between a lab result and these records have a purpose (medications do not). */
export const PURPOSE_LINK_KEYS = ['conditions', 'procedures'] as const;
