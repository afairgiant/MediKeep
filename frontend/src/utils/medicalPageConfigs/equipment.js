/**
 * Medical equipment page configuration
 */

import {
  EQUIPMENT_STATUS_OPTIONS,
  EQUIPMENT_TYPE_OPTIONS,
} from '../../constants/equipmentConstants';

export const equipmentPageConfig = {
  filtering: {
    searchFields: [
      'equipment_name',
      'manufacturer',
      'model_number',
      'serial_number',
      'supplier',
    ],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'filters.defaults.status.all' },
      ...EQUIPMENT_STATUS_OPTIONS,
    ],
    typeField: 'equipment_type',
    typeOptions: [
      { value: 'all', label: 'filters.defaults.type.all' },
      ...EQUIPMENT_TYPE_OPTIONS,
    ],
  },
  sorting: {
    defaultSortBy: 'equipment_name',
    defaultSortOrder: 'asc',
    sortOptions: [
      { value: 'equipment_name', label: 'shared:labels.equipmentName' },
      { value: 'equipment_type', label: 'equipment.form.type' },
      { value: 'status', label: 'shared:fields.status' },
      { value: 'prescribed_date', label: 'equipment.fields.prescribedDate' },
      { value: 'next_service_date', label: 'equipment.fields.nextService' },
    ],
    sortTypes: {
      equipment_name: 'string',
      equipment_type: 'string',
      status: 'status',
      prescribed_date: 'date',
      next_service_date: 'date',
    },
    statusOrder: {
      active: 1,
      inactive: 2,
      replaced: 3,
      returned: 4,
      lost: 5,
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.equipment',
    showStatus: true,
    showType: true,
  },
};
