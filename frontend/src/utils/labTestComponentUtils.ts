/**
 * Shared utilities for lab test component operations.
 * Extracted from TestComponentTemplates for reuse in InlineTestComponentEntry.
 */

import sanitizeHtml from 'sanitize-html';
import {
  LabTestComponentCreate,
  QualitativeValue,
} from '../services/api/labTestComponentApi';
import { ComponentCategory, ComponentStatus } from '../constants/labCategories';

let nextRowId = 1;

/** Shape of a component row used in both TestComponentTemplates and InlineTestComponentEntry. */
export interface ComponentRowData {
  _rowId: number;
  test_name: string;
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
  result_type?: 'quantitative' | 'qualitative';
  qualitative_value?: string;
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
  };
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/** Check whether a component row has a valid filled value (quantitative or qualitative). */
export function hasFilledValue(component: ComponentRowData): boolean {
  if (component.result_type === 'qualitative') {
    return !!component.qualitative_value;
  }
  return isValidNumber(component.value);
}

/** Check whether a component row is complete enough to submit (has value, test name, and unit for quantitative). */
export function isSubmittableComponent(component: ComponentRowData): boolean {
  if (component.result_type === 'qualitative') {
    return hasFilledValue(component) && component.test_name.trim() !== '';
  }

  return (
    hasFilledValue(component) &&
    component.test_name.trim() !== '' &&
    component.unit.trim() !== ''
  );
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
  const isQualitative = component.result_type === 'qualitative';
  return {
    lab_result_id: labResultId,
    test_name: sanitizeInput(component.test_name) || '',
    abbreviation: sanitizeInput(component.abbreviation),
    test_code: sanitizeInput(component.test_code),
    value: isQualitative
      ? null
      : isValidNumber(component.value)
        ? component.value
        : null,
    unit: isQualitative ? null : sanitizeInput(component.unit) || '',
    ref_range_min:
      component.ref_range_min === ''
        ? null
        : (component.ref_range_min as number),
    ref_range_max:
      component.ref_range_max === ''
        ? null
        : (component.ref_range_max as number),
    ref_range_text: sanitizeInput(component.ref_range_text),
    status: (component.status as ComponentStatus | null) || null,
    category: (component.category as ComponentCategory | null) || null,
    display_order: component.display_order ?? null,
    notes: sanitizeInput(component.notes),
    result_type: component.result_type || 'quantitative',
    qualitative_value:
      (component.qualitative_value as QualitativeValue) || null,
  };
}
