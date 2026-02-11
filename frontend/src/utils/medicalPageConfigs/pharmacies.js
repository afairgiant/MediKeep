/**
 * Pharmacies page configuration
 */

export const pharmaciesPageConfig = {
  filtering: {
    searchFields: ['name', 'brand', 'city', 'state', 'zip_code', 'country', 'store_number', 'specialty_services'],
    categoryField: 'brand',
    categoryLabel: 'Brands',
  },
  sorting: {
    defaultSortBy: 'name',
    defaultSortOrder: 'asc',
    sortOptions: [
      { value: 'name', label: 'Name' },
      { value: 'brand', label: 'Brand' },
      { value: 'city', label: 'City' },
    ],
    sortTypes: {
      name: 'string',
      brand: 'string',
      city: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.pharmacies',
    title: 'Filter & Sort Pharmacies',
    showStatus: false,
    showCategory: true,
  },
};
