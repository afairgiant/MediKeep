/**
 * Shared utilities for lab test component operations.
 * Extracted from TestComponentTemplates for reuse in InlineTestComponentEntry.
 */

import sanitizeHtml from 'sanitize-html';
import { notifications } from '@mantine/notifications';
import {
  LabTestComponentCreate,
  QualitativeValue,
  labTestComponentApi,
} from '../services/api/labTestComponentApi';
import { ComponentCategory, ComponentStatus } from '../constants/labCategories';
import logger from '../services/logger';

/**
 * Maximum length for the alternative reference range text.
 * Must match MAX_REF_RANGE_TEXT_LENGTH in app/core/constants.py (#894).
 */
export const MAX_REF_RANGE_TEXT_LENGTH = 500;

let nextRowId = 1;

/** Shape of a component row used in both TestComponentTemplates and InlineTestComponentEntry. */
export interface ComponentRowData {
  _rowId: number;
  test_name: string;
  canonical_test_name?: string | null;
  abbreviation?: string;
  test_code?: string;
  value: number | '';
  unit: string;
  ref_range_min: number | '';
  ref_range_max: number | '';
  ref_range_text?: string;
  status?: string;
  category?: string;
  display_order?: number;
  notes?: string;
  result_type?: 'quantitative' | 'qualitative' | 'textual';
  qualitative_value?: string;
  textual_value?: string;
}

/** Create an empty component row with default values. */
export function createEmptyRow(displayOrder: number): ComponentRowData {
  return {
    _rowId: nextRowId++,
    test_name: '',
    abbreviation: '',
    test_code: '',
    value: '',
    unit: '',
    ref_range_min: '',
    ref_range_max: '',
    ref_range_text: '',
    status: '',
    display_order: displayOrder,
    notes: '',
    result_type: 'quantitative',
    qualitative_value: '',
    textual_value: '',
  };
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/** Check whether a component row has a valid filled value (quantitative, qualitative, or textual). */
export function hasFilledValue(component: ComponentRowData): boolean {
  if (component.result_type === 'qualitative') {
    return !!component.qualitative_value;
  }
  if (component.result_type === 'textual') {
    return !!component.textual_value;
  }
  return isValidNumber(component.value);
}

/** Check whether a component row is complete enough to submit (has a test name). */
export function isSubmittableComponent(component: ComponentRowData): boolean {
  return component.test_name.trim() !== '';
}

/**
 * Auto-calculate status based on value and reference range.
 * Returns 'normal', 'high', 'low', or undefined.
 */
export function calculateStatus(
  value: number | '',
  refMin: number | '',
  refMax: number | ''
): string | undefined {
  if (!isValidNumber(value)) return undefined;

  const hasMin = isValidNumber(refMin);
  const hasMax = isValidNumber(refMax);

  if (!hasMin && !hasMax) return undefined;

  if (hasMin && value < refMin) return 'low';
  if (hasMax && value > refMax) return 'high';
  return 'normal';
}

/** Capitalize first letter of a status string for display. */
export function capitalizeStatus(status: string | undefined): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Map status to a color for the read-only status input. */
export function getStatusInputColor(status: string | undefined): string {
  if (!status) return '#868e96';
  switch (status) {
    case 'high':
    case 'critical':
      return '#fa5252';
    case 'low':
      return '#fd7e14';
    case 'abnormal':
      return '#fd7e14';
    case 'normal':
      return '#51cf66';
    default:
      return '#868e96';
  }
}

/** Sanitize a string input to prevent XSS using sanitize-html. */
function sanitizeInput(input: string | undefined): string | null {
  if (!input) return null;
  const sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
  return sanitized || null;
}

/** Sanitize a ComponentRowData and convert it to a LabTestComponentCreate for the API. */
export function sanitizeComponentForApi(
  component: ComponentRowData,
  labResultId: number
): LabTestComponentCreate {
  const rt = component.result_type || 'quantitative';
  const isQualitative = rt === 'qualitative';
  const isTextual = rt === 'textual';
  const isNumeric = !isQualitative && !isTextual;
  return {
    lab_result_id: labResultId,
    test_name: sanitizeInput(component.test_name) || '',
    canonical_test_name: sanitizeInput(component.canonical_test_name ?? undefined) || null,
    abbreviation: sanitizeInput(component.abbreviation),
    test_code: sanitizeInput(component.test_code),
    value: isNumeric
      ? isValidNumber(component.value)
        ? component.value
        : null
      : null,
    unit: isNumeric ? sanitizeInput(component.unit) || '' : null,
    ref_range_min: isNumeric
      ? component.ref_range_min === ''
        ? null
        : (component.ref_range_min as number)
      : null,
    ref_range_max: isNumeric
      ? component.ref_range_max === ''
        ? null
        : (component.ref_range_max as number)
      : null,
    ref_range_text: isNumeric ? sanitizeInput(component.ref_range_text) : null,
    status: (component.status as ComponentStatus | null) || null,
    category: (component.category as ComponentCategory | null) || null,
    display_order: component.display_order ?? null,
    notes: sanitizeInput(component.notes),
    result_type: rt,
    qualitative_value: isQualitative
      ? (component.qualitative_value as QualitativeValue) || null
      : null,
    textual_value: isTextual ? sanitizeInput(component.textual_value) : null,
  };
}

/**
 * Bulk-create staged component rows against a lab result that already exists,
 * logging and notifying on partial/total failure. Shared by every "create a lab
 * result, then attach its pending test components" flow (advanced create form,
 * simple-mode panel dialog) so they don't each reimplement the same error handling.
 */
export async function submitPendingTestComponents(
  labResultId: number,
  pendingComponents: ComponentRowData[],
  patientId: number | null | undefined,
  source: string,
  t: (_key: string, _fallback: string) => string
): Promise<void> {
  if (pendingComponents.length === 0) return;

  const apiComponents = pendingComponents.map(row =>
    sanitizeComponentForApi(row, labResultId)
  );

  try {
    const bulkResult = await labTestComponentApi.createBulkForLabResult(
      labResultId,
      apiComponents,
      patientId
    );

    if (bulkResult.errors?.length > 0) {
      logger.error('test_component_partial_save_failure', {
        message: 'Some test components failed to save',
        labResultId,
        errors: bulkResult.errors,
        component: source,
      });
      notifications.show({
        title: t(
          'medical:labResults.addPanel.componentPartialSaveTitle',
          'Some components not saved'
        ),
        message: t(
          'medical:labResults.addPanel.componentPartialSaveMessage',
          'The panel was created but some test components failed to save. Edit the panel to review.'
        ),
        color: 'yellow',
        autoClose: 8000,
      });
    }
  } catch (err: unknown) {
    logger.error('test_component_bulk_save_failure', {
      message: 'Bulk component creation failed after lab result was created',
      labResultId,
      error: err instanceof Error ? err.message : String(err),
      component: source,
    });
    notifications.show({
      title: t(
        'medical:labResults.addPanel.componentSaveFailedTitle',
        'Test components not saved'
      ),
      message: t(
        'medical:labResults.addPanel.componentSaveFailedMessage',
        'The panel was created but test components could not be saved. Edit the panel to add them.'
      ),
      color: 'red',
      autoClose: 8000,
    });
  }
}
