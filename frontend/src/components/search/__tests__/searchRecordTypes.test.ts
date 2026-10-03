import { describe, it, expect } from 'vitest';

import searchService from '../../../services/searchService';
import { RECORD_TYPES, sortRecordTypesByLabel } from '../SearchFilterSidebar';
import {
  ICON_MAP,
  RECORD_TYPE_TO_TAG_ENTITY,
  TAG_ENTITY_CONFIG,
  TYPE_LABEL_KEY_MAP,
  flattenTagResults,
  getItemDateWithLabel,
  getItemSubtitle,
  getItemTitle,
  getTypeLabel,
  type TFunc,
} from '../searchResultHelpers';

// Echo the key so assertions can tell a translated label from a raw fallback.
const t: TFunc = key => key;

// Backend group key (plural, as in RECORD_TYPES) -> item `type` (singular)
const GROUP_TO_ITEM_TYPE: Record<string, string> = {
  medications: 'medication',
  conditions: 'condition',
  lab_results: 'lab_result',
  procedures: 'procedure',
  immunizations: 'immunization',
  treatments: 'treatment',
  encounters: 'encounter',
  allergies: 'allergy',
  injuries: 'injury',
  symptoms: 'symptom',
  medical_equipment: 'medical_equipment',
  vitals: 'vital',
};

describe('search record types stay in sync', () => {
  it('knows the item type of every sidebar record type', () => {
    RECORD_TYPES.forEach(rt => {
      expect(GROUP_TO_ITEM_TYPE[rt.value], rt.value).toBeDefined();
    });
  });

  it.each(RECORD_TYPES.map(rt => rt.value))(
    'renders backend results for %s',
    groupKey => {
      const itemType = GROUP_TO_ITEM_TYPE[groupKey];
      const row = searchService.formatResultItem(groupKey, {
        id: 7,
        type: itemType,
      });

      expect(row).not.toBeNull();
      expect(row.type).toBe(itemType);
      expect(ICON_MAP[row.icon]).toBeDefined();
      expect(TYPE_LABEL_KEY_MAP[itemType]).toBeDefined();
      expect(searchService.getRecordRoute(itemType, 7)).not.toBe('/dashboard');
    }
  );

  it.each(Object.entries(RECORD_TYPE_TO_TAG_ENTITY))(
    'has tag search config for %s',
    (_recordType, entity) => {
      expect(TAG_ENTITY_CONFIG[entity], entity).toBeDefined();
      expect(TYPE_LABEL_KEY_MAP[entity], entity).toBeDefined();
    }
  );

  it('offers a tag entity for every sidebar type except vitals', () => {
    RECORD_TYPES.filter(rt => rt.value !== 'vitals').forEach(rt => {
      expect(RECORD_TYPE_TO_TAG_ENTITY[rt.value], rt.value).toBeDefined();
    });
  });
});

// Text search items are exactly what the backend `*SearchItem` schemas return:
// no notes and no created_at, so description is empty and the date has no
// fallback. Tag search returns raw table rows, which do carry both.
const textItemBase = { tags: [] as string[], highlight: '', score: 0.9 };

describe('injury search results', () => {
  const textItem = {
    ...textItemBase,
    id: 3,
    type: 'injury',
    injury_name: 'Sprained ankle',
    body_part: 'Ankle',
    severity: 'moderate',
    status: 'active',
    date_of_injury: '2026-09-01',
  };
  const tagRow = {
    id: 3,
    injury_name: 'Sprained ankle',
    body_part: 'Ankle',
    status: 'active',
    date_of_injury: '2026-09-01',
    created_at: '2026-09-02T00:00:00',
    notes: 'Rest and ice',
    tags: ['sports'],
  };

  it('formats text search results from the injury item fields', () => {
    const row = searchService.formatResultItem('injuries', {
      ...textItem,
      tags: ['sports'],
    });

    expect(row).toMatchObject({
      type: 'injury',
      id: 3,
      title: 'Sprained ankle',
      subtitle: 'Ankle - active',
      date: '2026-09-01',
      tags: ['sports'],
    });
  });

  it('has no date for an undated injury', () => {
    const row = searchService.formatResultItem('injuries', {
      ...textItem,
      date_of_injury: null,
    });

    expect(row.date).toBeUndefined();
  });

  it('reads tag search rows (raw table columns) the same way', () => {
    expect(getItemTitle('injury', tagRow, t)).toBe('Sprained ankle');
    expect(getItemSubtitle('injury', tagRow, t)).toBe('Ankle - active');
    expect(getItemDateWithLabel('injury', tagRow, t)).toEqual({
      label: 'search.dateLabels.injured',
      value: '2026-09-01',
    });
    expect(
      getItemDateWithLabel('injury', { ...tagRow, date_of_injury: null }, t)
        .value
    ).toBe(tagRow.created_at);
    expect(getItemTitle('injury', {}, t)).toBe('search.fallbacks.injury');
  });

  it('links to the injuries page', () => {
    expect(searchService.getRecordRoute('injury', 3)).toBe('/injuries?view=3');
    expect(getTypeLabel(t, 'injury')).toBe('shared:categories.injuries');
  });

  it('includes injuries in flattened tag results', () => {
    const rows = flattenTagResults({ injury: [tagRow] }, t);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'injury',
      id: 3,
      title: 'Sprained ankle',
      route: '/injuries?view=3',
      _source: 'tag',
    });
  });
});

describe('medical equipment search results', () => {
  const textItem = {
    ...textItemBase,
    id: 5,
    type: 'medical_equipment',
    equipment_name: 'CPAP machine',
    equipment_type: 'CPAP',
    manufacturer: 'ResMed',
    status: 'active',
    prescribed_date: '2026-07-04',
  };
  const tagRow = {
    id: 5,
    equipment_name: 'CPAP machine',
    equipment_type: 'CPAP',
    status: 'active',
    prescribed_date: '2026-07-04',
    created_at: '2026-07-05T00:00:00',
    notes: 'Clean filter weekly',
    tags: ['sleep'],
  };

  it('formats text search results from the equipment item fields', () => {
    const row = searchService.formatResultItem('medical_equipment', textItem);

    expect(row).toMatchObject({
      type: 'medical_equipment',
      id: 5,
      title: 'CPAP machine',
      subtitle: 'CPAP - active',
      date: '2026-07-04',
    });
  });

  it('has no date when there is no prescribed date', () => {
    const row = searchService.formatResultItem('medical_equipment', {
      ...textItem,
      prescribed_date: null,
    });

    expect(row.date).toBeUndefined();
  });

  it('reads tag search rows (raw table columns) the same way', () => {
    expect(getItemTitle('medical_equipment', tagRow, t)).toBe('CPAP machine');
    expect(getItemSubtitle('medical_equipment', tagRow, t)).toBe(
      'CPAP - active'
    );
    expect(getItemDateWithLabel('medical_equipment', tagRow, t)).toEqual({
      label: 'search.dateLabels.prescribed',
      value: '2026-07-04',
    });
    expect(getItemTitle('medical_equipment', {}, t)).toBe(
      'search.fallbacks.equipment'
    );
  });

  it('links to the medical equipment page', () => {
    expect(searchService.getRecordRoute('medical_equipment', 5)).toBe(
      '/medical-equipment?view=5'
    );
    expect(getTypeLabel(t, 'medical_equipment')).toBe(
      'shared:categories.medical_equipment'
    );
  });

  it('includes equipment in flattened tag results', () => {
    const rows = flattenTagResults({ medical_equipment: [tagRow] }, t);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'medical_equipment',
      id: 5,
      route: '/medical-equipment?view=5',
      _source: 'tag',
    });
  });
});

describe('symptom search results', () => {
  const textItem = {
    ...textItemBase,
    id: 9,
    type: 'symptom',
    symptom_name: 'Dizziness',
    category: 'neurological',
    status: 'active',
    first_occurrence_date: '2026-08-15',
  };
  const tagRow = {
    id: 9,
    symptom_name: 'Dizziness',
    category: 'neurological',
    status: 'active',
    first_occurrence_date: '2026-08-15',
    created_at: '2026-08-16T00:00:00',
    general_notes: 'Worse when standing',
    tags: [],
  };

  it('formats text search results from the symptom item fields', () => {
    const row = searchService.formatResultItem('symptoms', textItem);

    expect(row).toMatchObject({
      type: 'symptom',
      id: 9,
      title: 'Dizziness',
      subtitle: 'neurological - active',
      date: '2026-08-15',
    });
  });

  it('omits missing subtitle parts without stray separators', () => {
    const row = searchService.formatResultItem('symptoms', {
      ...textItem,
      category: null,
    });

    expect(row.subtitle).toBe('active');
  });

  it('reads tag search rows (raw table columns) the same way', () => {
    expect(getItemTitle('symptom', tagRow, t)).toBe('Dizziness');
    expect(getItemDateWithLabel('symptom', tagRow, t).value).toBe('2026-08-15');
    expect(getItemTitle('symptom', {}, t)).toBe('search.fallbacks.symptom');
  });

  it('links to the symptoms page', () => {
    expect(searchService.getRecordRoute('symptom', 9)).toBe('/symptoms?view=9');
  });
});

describe('sortRecordTypesByLabel', () => {
  const labels: Record<string, string> = Object.fromEntries(
    RECORD_TYPES.map(rt => [rt.labelKey, rt.value])
  );
  const labelOf = (key: string) => labels[key];

  it('orders record types alphabetically by translated label', () => {
    const sorted = sortRecordTypesByLabel(RECORD_TYPES, labelOf, 'en');
    const names = sorted.map(rt => labelOf(rt.labelKey));

    expect(names).toEqual(
      [...names].sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' })
      )
    );
    expect(names).not.toEqual(RECORD_TYPES.map(rt => rt.value));
  });

  it('sorts by the translated text, not the record type value', () => {
    const translated: Record<string, string> = {
      'shared:categories.allergies': 'Zebra',
      'shared:categories.medications': 'Apple',
    };
    const subset = RECORD_TYPES.filter(rt => rt.labelKey in translated);

    const sorted = sortRecordTypesByLabel(subset, k => translated[k], 'en');

    expect(sorted.map(rt => rt.value)).toEqual(['medications', 'allergies']);
  });

  it('uses locale rules for accented labels', () => {
    // A code-point sort would put 'É' (U+00C9) after 'Z'
    const translated: Record<string, string> = {
      'shared:categories.allergies': 'Zèbre',
      'shared:categories.medications': 'Étude',
      'shared:categories.conditions': 'Arbre',
    };
    const subset = RECORD_TYPES.filter(rt => rt.labelKey in translated);

    const sorted = sortRecordTypesByLabel(subset, k => translated[k], 'fr');

    expect(sorted.map(rt => translated[rt.labelKey])).toEqual([
      'Arbre',
      'Étude',
      'Zèbre',
    ]);
  });

  it('keeps every record type and does not mutate the source list', () => {
    const before = RECORD_TYPES.map(rt => rt.value);

    const sorted = sortRecordTypesByLabel(RECORD_TYPES, labelOf, 'en');

    expect(sorted).toHaveLength(RECORD_TYPES.length);
    expect(sorted.map(rt => rt.value).sort()).toEqual([...before].sort());
    expect(RECORD_TYPES.map(rt => rt.value)).toEqual(before);
  });

  it('falls back instead of throwing on a malformed language tag', () => {
    expect(() =>
      sortRecordTypesByLabel(RECORD_TYPES, labelOf, 'en_US')
    ).not.toThrow();
  });
});
