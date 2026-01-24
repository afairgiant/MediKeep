/**
 * Family Members page configuration
 */

import { SEARCH_TERM_MAX_LENGTH, logger } from './shared.js';

export const familyMembersPageConfig = {
  filtering: {
    searchFields: ['name', 'relationship', 'notes'],
    customSearchFunction: (item, searchTerm) => {
      // Validate and sanitize search term
      if (!searchTerm || typeof searchTerm !== 'string') {
        return true; // Show all items if search term is invalid
      }

      let sanitizedTerm = searchTerm.trim().toLowerCase();
      if (sanitizedTerm.length === 0) {
        return true; // Show all items if search term is empty after trimming
      }

      // Additional validation: prevent extremely long search terms that could cause performance issues
      if (sanitizedTerm.length > SEARCH_TERM_MAX_LENGTH) {
        logger.warn(`Search term too long, truncating to ${SEARCH_TERM_MAX_LENGTH} characters`, {
          component: 'medicalPageConfigs',
          originalLength: sanitizedTerm.length,
          truncatedLength: SEARCH_TERM_MAX_LENGTH
        });
        sanitizedTerm = sanitizedTerm.substring(0, SEARCH_TERM_MAX_LENGTH);
      }

      // Search in basic family member fields
      const basicFields = ['name', 'relationship', 'notes'];
      const matchesBasic = basicFields.some(field => {
        const value = item[field];
        if (!value) return false;
        try {
          return value.toString().toLowerCase().includes(sanitizedTerm);
        } catch (error) {
          logger.warn(`Error processing search field "${field}"`, {
            component: 'medicalPageConfigs',
            field,
            value,
            valueType: typeof value,
            error: error.message,
            searchTerm: sanitizedTerm
          });
          return false;
        }
      });

      if (matchesBasic) return true;

      // Search in tags
      if (item.tags && Array.isArray(item.tags)) {
        const matchesTags = item.tags.some(tag => {
          if (!tag) return false;
          try {
            return tag.toString().toLowerCase().includes(sanitizedTerm);
          } catch (error) {
            logger.warn(`Error processing tag search`, {
              component: 'medicalPageConfigs',
              tag,
              tagType: typeof tag,
              error: error.message,
              searchTerm: sanitizedTerm
            });
            return false;
          }
        });

        if (matchesTags) return true;
      }

      // Search in family conditions
      if (item.family_conditions && Array.isArray(item.family_conditions)) {
        const conditionFields = ['condition_name', 'notes', 'condition_type', 'severity', 'status'];
        const matchesCondition = item.family_conditions.some(condition => {
          if (!condition || typeof condition !== 'object') return false;

          return conditionFields.some(field => {
            const value = condition[field];
            if (!value) return false;
            try {
              return value.toString().toLowerCase().includes(sanitizedTerm);
            } catch (error) {
              logger.warn(`Error processing condition search field "${field}"`, {
                component: 'medicalPageConfigs',
                field,
                value,
                valueType: typeof value,
                error: error.message,
                searchTerm: sanitizedTerm,
                conditionId: condition?.id
              });
              return false;
            }
          });
        });

        if (matchesCondition) return true;
      }

      return false;
    },
    categoryField: 'relationship',
    categoryLabel: 'Relationship',
    categoryOptions: [
      { value: 'all', label: 'All Relationships' },
      { value: 'father', label: 'Father' },
      { value: 'mother', label: 'Mother' },
      { value: 'brother', label: 'Brother' },
      { value: 'sister', label: 'Sister' },
      { value: 'paternal_grandfather', label: 'Paternal Grandfather' },
      { value: 'paternal_grandmother', label: 'Paternal Grandmother' },
      { value: 'maternal_grandfather', label: 'Maternal Grandfather' },
      { value: 'maternal_grandmother', label: 'Maternal Grandmother' },
      { value: 'uncle', label: 'Uncle' },
      { value: 'aunt', label: 'Aunt' },
      { value: 'cousin', label: 'Cousin' },
      { value: 'other', label: 'Other' },
    ],
    statusField: 'is_deceased',
    statusOptions: [
      { value: 'all', label: 'All Members' },
      { value: 'false', label: 'Living' },
      { value: 'true', label: 'Deceased' },
    ],
    customFilters: {
      is_deceased: (item, filterValue) => {
        if (filterValue === 'all') return true;
        return item.is_deceased === (filterValue === 'true');
      },
    },
  },
  sorting: {
    defaultSortBy: 'relationship',
    defaultSortOrder: 'asc',
    sortOptions: [
      { value: 'relationship', label: 'Relationship' },
      { value: 'name', label: 'Name' },
      { value: 'birth_year', label: 'Birth Year' },
    ],
    sortTypes: {
      name: 'string',
      relationship: 'string',
      birth_year: 'number',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.familyHistory',
    title: 'Filter & Sort Family Members',
    showCategory: true,
    showStatus: true,
    description: 'Filter family members by relationship and status',
  },
  // Table configuration for flattened conditions view
  table: {
    columns: [
      {
        key: 'familyMemberName',
        label: 'Family Member',
        sortable: true,
        width: '120px',
      },
      {
        key: 'relationship',
        label: 'Relationship',
        sortable: true,
        width: '100px',
        render: (value) => value?.replace('_', ' ') || '-',
      },
      {
        key: 'condition_name',
        label: 'Condition',
        sortable: true,
        width: '150px',
        render: (value) => value || 'No conditions',
        style: (row) => ({
          fontStyle: row.condition_name ? 'normal' : 'italic',
          color: row.condition_name ? 'inherit' : 'var(--mantine-color-dimmed)',
        }),
      },
      {
        key: 'condition_type',
        label: 'Type',
        sortable: true,
        width: '120px',
        render: (value) => value?.replace('_', ' ') || '-',
      },
      {
        key: 'severity',
        label: 'Severity',
        sortable: true,
        width: '100px',
        render: (value) => {
          if (!value) return '-';
          const colors = {
            mild: 'green',
            moderate: 'yellow',
            severe: 'red',
            critical: 'red'
          };
          return {
            type: 'badge',
            color: colors[value] || 'gray',
            text: value,
          };
        },
      },
      {
        key: 'diagnosis_age',
        label: 'Diagnosis Age',
        sortable: true,
        width: '100px',
        render: (value) => value ? `${value} years` : '-',
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        width: '100px',
        render: (value) => {
          if (!value) return '-';
          const colors = {
            active: 'blue',
            resolved: 'green',
            chronic: 'orange'
          };
          return {
            type: 'badge',
            variant: 'light',
            color: colors[value] || 'gray',
            text: value,
          };
        },
      },
    ],
    actions: {
      view: (row) => row.familyMemberId,
      edit: (row) => row.conditionId ? { familyMember: row, condition: row } : null,
      delete: (row) => row.conditionId ? { familyMemberId: row.familyMemberId, conditionId: row.conditionId } : null,
    },
  },
};
