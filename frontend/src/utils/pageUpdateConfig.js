import fs from 'fs';
import path from 'path';

// Configuration for each medical page
const pageConfigs = {
  'Procedures.js': {
    tableName: 'Procedures',
    emptyIcon: '🏥',
    emptyText: 'No procedures found',
    columns: [
      { header: 'Procedure Name', accessor: 'procedure_name' },
      { header: 'Date', accessor: 'procedure_date' },
      { header: 'Status', accessor: 'status' },
      { header: 'Location', accessor: 'location' },
      { header: 'Practitioner', accessor: 'practitioner_name' },
      { header: 'Notes', accessor: 'notes' },
    ],
    formatters: {
      procedure_name: 'primary-field',
      procedure_date: 'formatDate',
      status: 'status-badge',
      notes: 'truncate-50',
    },
  },
  'Allergies.js': {
    tableName: 'Allergies',
    emptyIcon: '🤧',
    emptyText: 'No allergies found',
    columns: [
      { header: 'Allergen', accessor: 'allergen' },
      { header: 'Reaction', accessor: 'reaction' },
      { header: 'Severity', accessor: 'severity' },
      { header: 'Date Identified', accessor: 'date_identified' },
      { header: 'Status', accessor: 'status' },
      { header: 'Notes', accessor: 'notes' },
    ],
    formatters: {
      allergen: 'primary-field',
      date_identified: 'formatDate',
      severity: 'status-badge',
      status: 'status-badge',
      notes: 'truncate-50',
    },
  },
  'Conditions.js': {
    tableName: 'Conditions',
    emptyIcon: '🩺',
    emptyText: 'No conditions found',
    columns: [
      { header: 'Condition Name', accessor: 'condition_name' },
      { header: 'Date Diagnosed', accessor: 'date_diagnosed' },
      { header: 'Status', accessor: 'status' },
      { header: 'Severity', accessor: 'severity' },
      { header: 'Notes', accessor: 'notes' },
    ],
    formatters: {
      condition_name: 'primary-field',
      date_diagnosed: 'formatDate',
      status: 'status-badge',
      severity: 'status-badge',
      notes: 'truncate-50',
    },
  },
  'Treatments.js': {
    tableName: 'Treatments',
    emptyIcon: '💊',
    emptyText: 'No treatments found',
    columns: [
      { header: 'Treatment Name', accessor: 'treatment_name' },
      { header: 'Start Date', accessor: 'start_date' },
      { header: 'End Date', accessor: 'end_date' },
      { header: 'Status', accessor: 'status' },
      { header: 'Notes', accessor: 'notes' },
    ],
    formatters: {
      treatment_name: 'primary-field',
      start_date: 'formatDate',
      end_date: 'formatDate',
      status: 'status-badge',
      notes: 'truncate-50',
    },
  },
  'Visits.js': {
    tableName: 'Visit History',
    emptyIcon: '📅',
    emptyText: 'No visits found',
    columns: [
      { header: 'Visit Date', accessor: 'visit_date' },
      { header: 'Visit Type', accessor: 'visit_type' },
      { header: 'Chief Complaint', accessor: 'chief_complaint' },
      { header: 'Practitioner', accessor: 'practitioner_name' },
      { header: 'Status', accessor: 'status' },
      { header: 'Notes', accessor: 'notes' },
    ],
    formatters: {
      visit_date: 'formatDate-primary',
      visit_type: 'status-badge',
      status: 'status-badge',
      notes: 'truncate-50',
    },
  },
};

console.log('Medical page configurations:', pageConfigs);
