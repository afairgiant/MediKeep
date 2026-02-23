/**
 * Emergency Contacts page configuration
 */

export const emergencyContactsPageConfig = {
  filtering: {
    searchFields: ['name', 'relationship', 'phone_number', 'email'],
    statusField: 'is_active',
    statusOptions: [
      { value: 'all', label: 'All Contacts' },
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' },
    ],
    categoryField: 'relationship',
    categoryLabel: 'Relationship',
    categoryOptions: [
      { value: 'all', label: 'All Relationships' },
      { value: 'spouse', label: 'Spouse' },
      { value: 'partner', label: 'Partner' },
      { value: 'parent', label: 'Parent' },
      { value: 'child', label: 'Child' },
      { value: 'sibling', label: 'Sibling' },
      { value: 'grandparent', label: 'Grandparent' },
      { value: 'grandchild', label: 'Grandchild' },
      { value: 'friend', label: 'Friend' },
      { value: 'neighbor', label: 'Neighbor' },
      { value: 'caregiver', label: 'Caregiver' },
      { value: 'guardian', label: 'Guardian' },
      { value: 'other', label: 'Other' },
    ],
    customFilters: {
      is_active: (item, filterValue) => {
        if (filterValue === 'all') return true;
        return item.is_active === (filterValue === 'true');
      },
      is_primary: (item, filterValue) => {
        if (filterValue === 'all') return true;
        return item.is_primary === (filterValue === 'true');
      },
    },
    additionalFilters: [
      {
        field: 'is_primary',
        label: 'Primary Contact',
        options: [
          { value: 'all', label: 'All Contacts' },
          { value: 'true', label: 'Primary Only' },
          { value: 'false', label: 'Non-Primary' },
        ],
      },
    ],
  },
  sorting: {
    defaultSortBy: 'priority',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'priority', label: 'Priority (Primary First)' },
      { value: 'name', label: 'Name' },
      { value: 'relationship', label: 'Relationship' },
      { value: 'is_active', label: 'Status' },
    ],
    sortTypes: {
      name: 'string',
      relationship: 'string',
      is_active: 'boolean',
    },
    customSortFunctions: {
      priority: (a, b, sortOrder) => {
        // Primary contacts first
        if (a.is_primary !== b.is_primary) {
          return sortOrder === 'asc' ? (a.is_primary ? 1 : -1) : (a.is_primary ? -1 : 1);
        }
        // Then active contacts
        if (a.is_active !== b.is_active) {
          return sortOrder === 'asc' ? (a.is_active ? 1 : -1) : (a.is_active ? -1 : 1);
        }
        // Always sub-sort alphabetically A-Z within each group
        return a.name.localeCompare(b.name);
      },
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.emergencyContacts',
    title: 'Filter & Sort Emergency Contacts',
    showCategory: true,
    showStatus: true,
    showAdditionalFilters: true,
    description:
      'Filter emergency contacts by status, relationship, and priority',
  },
};
