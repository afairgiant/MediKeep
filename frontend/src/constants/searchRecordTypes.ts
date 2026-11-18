/** Advanced Search record types; every search lookup on the frontend derives from this list. */

import React from 'react';
import {
  IconAlertTriangle,
  IconBandage,
  IconCalendarEvent,
  IconDroplet,
  IconFlask,
  IconHeartbeat,
  IconHeartRateMonitor,
  IconMedicalCross,
  IconPill,
  IconStethoscope,
  IconThermometer,
  IconVaccine,
} from '@tabler/icons-react';

import { buildEntityUrl } from '../utils/entityNavigation';
import { ENTITY_TYPES } from '../utils/entityRelationships';

export interface SearchRecordType {
  /** Group key in the text search request and response (`types`, `results`). */
  value: string;
  /** Each result item's `type`, also the tag search entity key. */
  itemType: string;
  /** App entity type whose page opens the record. */
  entityType: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: string | number }>;
  color: string;
  /** False when the record type has no tags column. */
  taggable: boolean;
}

export const SEARCH_RECORD_TYPES = [
  {
    value: 'medications',
    itemType: 'medication',
    entityType: ENTITY_TYPES.MEDICATION,
    labelKey: 'shared:categories.medications',
    icon: IconPill,
    color: 'green',
    taggable: true,
  },
  {
    value: 'conditions',
    itemType: 'condition',
    entityType: ENTITY_TYPES.CONDITION,
    labelKey: 'shared:categories.conditions',
    icon: IconStethoscope,
    color: 'blue',
    taggable: true,
  },
  {
    value: 'lab_results',
    itemType: 'lab_result',
    entityType: ENTITY_TYPES.LAB_RESULT,
    labelKey: 'shared:categories.lab_results',
    icon: IconFlask,
    color: 'indigo',
    taggable: true,
  },
  {
    value: 'procedures',
    itemType: 'procedure',
    entityType: ENTITY_TYPES.PROCEDURE,
    labelKey: 'shared:categories.procedures',
    icon: IconMedicalCross,
    color: 'violet',
    taggable: true,
  },
  {
    value: 'immunizations',
    itemType: 'immunization',
    entityType: ENTITY_TYPES.IMMUNIZATION,
    labelKey: 'shared:categories.immunizations',
    icon: IconVaccine,
    color: 'orange',
    taggable: true,
  },
  {
    value: 'treatments',
    itemType: 'treatment',
    entityType: ENTITY_TYPES.TREATMENT,
    labelKey: 'shared:categories.treatments',
    icon: IconHeartbeat,
    color: 'pink',
    taggable: true,
  },
  {
    value: 'encounters',
    itemType: 'encounter',
    entityType: ENTITY_TYPES.ENCOUNTER,
    labelKey: 'search.types.encounters',
    icon: IconCalendarEvent,
    color: 'teal',
    taggable: true,
  },
  {
    value: 'allergies',
    itemType: 'allergy',
    entityType: ENTITY_TYPES.ALLERGY,
    labelKey: 'shared:categories.allergies',
    icon: IconAlertTriangle,
    color: 'red',
    taggable: true,
  },
  {
    value: 'injuries',
    itemType: 'injury',
    entityType: ENTITY_TYPES.INJURY,
    labelKey: 'shared:categories.injuries',
    icon: IconBandage,
    color: 'lime',
    taggable: true,
  },
  {
    value: 'symptoms',
    itemType: 'symptom',
    entityType: ENTITY_TYPES.SYMPTOM,
    labelKey: 'shared:categories.symptoms',
    icon: IconThermometer,
    color: 'grape',
    taggable: true,
  },
  {
    value: 'medical_equipment',
    itemType: 'medical_equipment',
    entityType: ENTITY_TYPES.MEDICAL_EQUIPMENT,
    labelKey: 'shared:categories.medical_equipment',
    icon: IconHeartRateMonitor,
    color: 'yellow',
    taggable: true,
  },
  {
    value: 'blood_donations',
    itemType: 'blood_donation',
    entityType: ENTITY_TYPES.BLOOD_DONATION,
    labelKey: 'shared:categories.blood_donations',
    icon: IconDroplet,
    color: 'red',
    taggable: true,
  },
  {
    value: 'vitals',
    itemType: 'vital',
    entityType: ENTITY_TYPES.VITALS,
    labelKey: 'shared:categories.vitals',
    icon: IconHeartbeat,
    color: 'cyan',
    taggable: false,
  },
] as const satisfies readonly SearchRecordType[];

export const RECORD_TYPE_BY_VALUE: Readonly<Record<string, SearchRecordType>> =
  Object.fromEntries(SEARCH_RECORD_TYPES.map(rt => [rt.value, rt]));

export const RECORD_TYPE_BY_ITEM_TYPE: Readonly<
  Record<string, SearchRecordType>
> = Object.fromEntries(SEARCH_RECORD_TYPES.map(rt => [rt.itemType, rt]));

/** Sidebar group key -> tag search entity key, for taggable types only. */
export const RECORD_TYPE_TO_TAG_ENTITY: Readonly<Record<string, string>> =
  Object.fromEntries(
    SEARCH_RECORD_TYPES.filter(rt => rt.taggable).map(rt => [
      rt.value,
      rt.itemType,
    ])
  );

/** Link that opens one record; unknown types go to the dashboard. */
export function getRecordRoute(itemType: string, id: number | string): string {
  const recordType = RECORD_TYPE_BY_ITEM_TYPE[itemType];
  return recordType
    ? buildEntityUrl(recordType.entityType, id, { autoOpen: true })
    : '/dashboard';
}
