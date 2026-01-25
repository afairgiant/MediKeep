import React from 'react';
import { createEntityLinkProps } from './linkNavigation';
import { MEDICATION_TYPE_LABELS } from '../constants/medicationTypes';

/**
 * Standardized table formatters for medical pages
 * Ensures consistent formatting across all medical tables
 */

/**
 * Creates standard formatters with a custom date formatter
 * @param {Function} formatDate - Date formatting function from useDateFormat hook
 * @returns {Object} Standard formatters object
 */
export const createStandardFormatters = (formatDate) => {
  // Helper for entity links (defined first so it can be referenced)
  const entityLink = (entityType, entityData, navigate, getEntityName = null) => {
    const linkProps = createEntityLinkProps(entityType, entityData, navigate, getEntityName);
    if (!linkProps) return '-';

    return (
      <span
        onClick={linkProps.onClick}
        style={linkProps.style}
        title={`Navigate to ${entityType}`}
      >
        {linkProps.text}
      </span>
    );
  };

  return {
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
      // Handle nested practitioner object first
      if (item.practitioner?.name) {
        return item.practitioner.name;
      }
      // Fall back to ID lookup
      if (!item.practitioner_id) {
        return '-';
      }
      const found = practitioners.find(p => p.id === item.practitioner_id)?.name || `Practitioner ID: ${item.practitioner_id}`;
      return found;
    },

    // Pharmacy fields
    pharmacy: (value, item) => {
      const result = item.pharmacy?.name || '-';
      return result;
    },

    // Clickable entity link formatter
    entityLink,

    // Clickable practitioner link
    practitionerLink: (value, item, practitioners = [], navigate, getEntityName = null) => {
      // Handle nested practitioner object first
      if (item.practitioner) {
        return entityLink('practitioner', item.practitioner, navigate, getEntityName);
      }
      // Fall back to ID lookup
      if (!item.practitioner_id) return '-';

      const practitioner = practitioners.find(p => p.id === item.practitioner_id) ||
                          { id: item.practitioner_id };

      return entityLink('practitioner', practitioner, navigate, getEntityName);
    },

    // Clickable pharmacy link
    pharmacyLink: (value, item, navigate, getEntityName = null) => {
      // Handle nested pharmacy object first
      if (item.pharmacy) {
        return entityLink('pharmacy', item.pharmacy, navigate, getEntityName);
      }
      // Fall back to ID lookup
      if (!item.pharmacy_id) return '-';

      const pharmacy = { id: item.pharmacy_id };

      return entityLink('pharmacy', pharmacy, navigate, getEntityName);
    },

    // Clickable condition link
    conditionLink: (value, item, navigate, getEntityName = null) => {
      if (!item.condition_id) return '-';

      const condition = item.condition || { id: item.condition_id };

      return entityLink('condition', condition, navigate, getEntityName);
    },

    // Simple text with fallback
    simple: value => value || '-',

    // Medication type - simple text for table readability
    medicationType: value => {
      return MEDICATION_TYPE_LABELS[value] || 'Prescription';
    },
  };
};

// Default formatters using ISO locale (for backwards compatibility)
// Components should use createStandardFormatters(formatDate) from useDateFormat hook
const defaultFormatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};
export const standardFormatters = createStandardFormatters(defaultFormatDate);

/**
 * Get formatters for a specific medical entity
 * @param {string} entityType - The type of medical entity (medications, procedures, etc.)
 * @param {Array} practitioners - Array of practitioners for reference
 * @param {function} navigate - React Router navigate function for links
 * @param {function} getEntityName - Optional function to get entity name by ID
 * @param {function} formatDate - Date formatting function from useDateFormat hook
 * @returns {Object} Formatters object for the entity
 */
export const getEntityFormatters = (entityType, practitioners = [], navigate = null, getEntityName = null, formatDate = null) => {
  // Use provided formatDate or fall back to standardFormatters
  const formatters = formatDate ? createStandardFormatters(formatDate) : standardFormatters;

  const baseFormatters = {
    status: formatters.status,
    date: formatters.date,
    text: formatters.text,
    simple: formatters.simple,
  };

  switch (entityType) {
    case 'medications':
      return {
        ...baseFormatters,
        medication_name: formatters.primaryName,
        medication_type: formatters.medicationType,
        dosage: formatters.code,
        frequency: formatters.simple,
        route: formatters.setting,
        indication: value => formatters.text(value, 50),
        effective_period_start: formatters.date,
        effective_period_end: formatters.date,
        practitioner_name: navigate
          ? (value, item) => formatters.practitionerLink(value, item, practitioners, navigate, getEntityName)
          : (value, item) => formatters.practitioner(value, item, practitioners),
        pharmacy_name: navigate
          ? (value, item) => formatters.pharmacyLink(value, item, navigate, getEntityName)
          : (value, item) => formatters.pharmacy(value, item),
      };

    case 'procedures':
      return {
        ...baseFormatters,
        procedure_name: formatters.primaryName,
        procedure_type: formatters.type,
        procedure_code: formatters.code,
        procedure_setting: formatters.setting,
        procedure_duration: formatters.duration,
        facility: formatters.simple,
        practitioner_name: navigate
          ? (value, item) => formatters.practitionerLink(value, item, practitioners, navigate, getEntityName)
          : (value, item) => formatters.practitioner(value, item, practitioners),
        description: value => formatters.text(value, 50),
        notes: value => formatters.text(value, 50),
      };

    case 'allergies':
      return {
        ...baseFormatters,
        allergy_name: formatters.primaryName,
        allergy_type: formatters.type,
        severity: formatters.status,
        reaction: value => formatters.text(value, 50),
        onset_date: formatters.date,
        notes: value => formatters.text(value, 50),
      };

    case 'conditions':
      return {
        ...baseFormatters,
        condition_name: formatters.primaryName,
        condition_type: formatters.type,
        severity: formatters.status,
        onset_date: formatters.date,
        end_date: formatters.date,
        notes: value => formatters.text(value, 50),
      };

    case 'lab_results':
      return {
        ...baseFormatters,
        test_name: formatters.primaryName,
        test_type: formatters.type,
        result_value: formatters.simple,
        unit: formatters.simple,
        reference_range: formatters.simple,
        result_date: formatters.date,
        status: formatters.status,
        notes: value => formatters.text(value, 50),
      };

    case 'immunizations':
      return {
        ...baseFormatters,
        immunization_name: formatters.primaryName,
        immunization_type: formatters.type,
        administration_date: formatters.date,
        next_due_date: formatters.date,
        lot_number: formatters.code,
        notes: value => formatters.text(value, 50),
      };

    case 'treatments':
      return {
        ...baseFormatters,
        treatment_name: formatters.primaryName,
        treatment_type: formatters.type,
        start_date: formatters.date,
        end_date: formatters.date,
        dosage: formatters.code,
        frequency: formatters.simple,
        notes: value => formatters.text(value, 50),
      };

    case 'visits':
      return {
        ...baseFormatters,
        visit_type: formatters.type,
        visit_date: formatters.date,
        facility: formatters.simple,
        practitioner_name: navigate
          ? (value, item) => formatters.practitionerLink(value, item, practitioners, navigate, getEntityName)
          : (value, item) => formatters.practitioner(value, item, practitioners),
        reason: value => formatters.text(value, 50),
        diagnosis: value => formatters.text(value, 50),
        notes: value => formatters.text(value, 50),
      };

    case 'vitals':
      return {
        ...baseFormatters,
        vital_type: formatters.type,
        vital_value: formatters.simple,
        unit: formatters.simple,
        measurement_date: formatters.date,
        notes: value => formatters.text(value, 50),
      };

    default:
      return baseFormatters;
  }
};

export default standardFormatters;
