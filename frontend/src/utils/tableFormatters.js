import React from 'react';
import { formatDate } from './helpers';

/**
 * Standardized table formatters for medical pages
 * Ensures consistent formatting across all medical tables
 */

// Standard formatters for common medical data types
export const standardFormatters = {
  // Primary name fields (medication_name, procedure_name, etc.)
  primaryName: value => (
    <span style={{ fontWeight: 600, minWidth: 150 }}>{value || '-'}</span>
  ),

  // Status fields - display as regular text with capitalization
  status: value =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : '-',

  // Date fields
  date: value => (value ? formatDate(value) : '-'),

  // Type/Category fields - display as regular text
  type: value => value || '-',

  // Setting/Route fields - display as regular text
  setting: value => value || '-',

  // Dosage/Code fields - display as regular text
  code: value => value || '-',

  // Duration/Amount fields - add units
  duration: (value, unit = 'min') => (value ? `${value} ${unit}` : '-'),

  // Text fields with truncation
  text: (value, maxLength = 50) =>
    value ? (
      <span title={value}>
        {value.length > maxLength
          ? `${value.substring(0, maxLength)}...`
          : value}
      </span>
    ) : (
      '-'
    ),

  // Practitioner/Doctor fields
  practitioner: (value, item, practitioners = []) => {
    if (!item.practitioner_id) return '-';
    return (
      practitioners.find(p => p.id === item.practitioner_id)?.name ||
      `Practitioner ID: ${item.practitioner_id}`
    );
  },

  // Pharmacy fields
  pharmacy: (value, item) => item.pharmacy?.name || '-',

  // Simple text with fallback
  simple: value => value || '-',
};

/**
 * Get formatters for a specific medical entity
 * @param {string} entityType - The type of medical entity (medications, procedures, etc.)
 * @param {Array} practitioners - Array of practitioners for reference
 * @returns {Object} Formatters object for the entity
 */
export const getEntityFormatters = (entityType, practitioners = []) => {
  const baseFormatters = {
    status: standardFormatters.status,
    date: standardFormatters.date,
    text: standardFormatters.text,
    simple: standardFormatters.simple,
  };

  switch (entityType) {
    case 'medications':
      return {
        ...baseFormatters,
        medication_name: standardFormatters.primaryName,
        dosage: standardFormatters.code,
        frequency: standardFormatters.simple,
        route: standardFormatters.setting,
        indication: value => standardFormatters.text(value, 50),
        effective_period_start: standardFormatters.date,
        effective_period_end: standardFormatters.date,
        practitioner_name: (value, item) =>
          standardFormatters.practitioner(value, item, practitioners),
        pharmacy_name: standardFormatters.pharmacy,
      };

    case 'procedures':
      return {
        ...baseFormatters,
        procedure_name: standardFormatters.primaryName,
        procedure_type: standardFormatters.type,
        procedure_code: standardFormatters.code,
        procedure_setting: standardFormatters.setting,
        procedure_duration: standardFormatters.duration,
        facility: standardFormatters.simple,
        practitioner_name: (value, item) =>
          standardFormatters.practitioner(value, item, practitioners),
        description: value => standardFormatters.text(value, 50),
        notes: value => standardFormatters.text(value, 50),
      };

    case 'allergies':
      return {
        ...baseFormatters,
        allergy_name: standardFormatters.primaryName,
        allergy_type: standardFormatters.type,
        severity: standardFormatters.status,
        reaction: value => standardFormatters.text(value, 50),
        onset_date: standardFormatters.date,
        notes: value => standardFormatters.text(value, 50),
      };

    case 'conditions':
      return {
        ...baseFormatters,
        condition_name: standardFormatters.primaryName,
        condition_type: standardFormatters.type,
        severity: standardFormatters.status,
        onset_date: standardFormatters.date,
        end_date: standardFormatters.date,
        notes: value => standardFormatters.text(value, 50),
      };

    case 'lab_results':
      return {
        ...baseFormatters,
        test_name: standardFormatters.primaryName,
        test_type: standardFormatters.type,
        result_value: standardFormatters.simple,
        unit: standardFormatters.simple,
        reference_range: standardFormatters.simple,
        result_date: standardFormatters.date,
        status: standardFormatters.status,
        notes: value => standardFormatters.text(value, 50),
      };

    case 'immunizations':
      return {
        ...baseFormatters,
        immunization_name: standardFormatters.primaryName,
        immunization_type: standardFormatters.type,
        administration_date: standardFormatters.date,
        next_due_date: standardFormatters.date,
        lot_number: standardFormatters.code,
        notes: value => standardFormatters.text(value, 50),
      };

    case 'treatments':
      return {
        ...baseFormatters,
        treatment_name: standardFormatters.primaryName,
        treatment_type: standardFormatters.type,
        start_date: standardFormatters.date,
        end_date: standardFormatters.date,
        dosage: standardFormatters.code,
        frequency: standardFormatters.simple,
        notes: value => standardFormatters.text(value, 50),
      };

    case 'visits':
      return {
        ...baseFormatters,
        visit_type: standardFormatters.type,
        visit_date: standardFormatters.date,
        facility: standardFormatters.simple,
        practitioner_name: (value, item) =>
          standardFormatters.practitioner(value, item, practitioners),
        reason: value => standardFormatters.text(value, 50),
        diagnosis: value => standardFormatters.text(value, 50),
        notes: value => standardFormatters.text(value, 50),
      };

    case 'vitals':
      return {
        ...baseFormatters,
        vital_type: standardFormatters.type,
        vital_value: standardFormatters.simple,
        unit: standardFormatters.simple,
        measurement_date: standardFormatters.date,
        notes: value => standardFormatters.text(value, 50),
      };

    default:
      return baseFormatters;
  }
};

export default standardFormatters;
