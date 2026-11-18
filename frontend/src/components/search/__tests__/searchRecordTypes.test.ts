import { describe, it, expect } from 'vitest';

import searchService from '../../../services/searchService';
import { sortRecordTypesByLabel } from '../SearchFilterSidebar';
import {
  RECORD_TYPE_TO_TAG_ENTITY,
  SEARCH_RECORD_TYPES,
  getRecordRoute,
} from '../../../constants/searchRecordTypes';
import {
  FALLBACK_ICON,
  describeSearchItem,
  flattenTagResults,
  getItemDescription,
  getItemDateWithLabel,
  getItemSubtitle,
  getItemTitle,
  getTypeIcon,
  getTypeLabel,
  toSearchRow,
  type TFunc,
} from '../searchResultHelpers';

// Echo the key so assertions can tell a translated label from a raw fallback.
const t: TFunc = key => key;

// Like i18next with no locale loaded: the default value wins when one is given
const tWithFallback: TFunc = (key, fallback) =>
  typeof fallback === 'string' ? fallback : key;

// A text search result as the search page renders it
function textRow(groupKey: string, item: Record<string, unknown>) {
  const raw = searchService.formatResultItem(groupKey, item);
  return toSearchRow(raw.type, raw.data, tWithFallback, 'text');
}

// Backend group key -> item `type`, as returned by GET /search/
const BACKEND_GROUP_TO_ITEM_TYPE: Record<string, string> = {
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
  blood_donations: 'blood_donation',
  vitals: 'vital',
};

describe('search record type registry', () => {
  it('covers exactly the record types the backend returns', () => {
    expect(
      Object.fromEntries(SEARCH_RECORD_TYPES.map(rt => [rt.value, rt.itemType]))
    ).toEqual(BACKEND_GROUP_TO_ITEM_TYPE);
  });

  it.each(SEARCH_RECORD_TYPES.map(rt => [rt.value, rt.itemType]))(
    'formats and links backend results for %s',
    (groupKey, itemType) => {
      const row = searchService.formatResultItem(groupKey, {
        id: 7,
        type: itemType,
      });

      expect(row).not.toBeNull();
      expect(row.type).toBe(itemType);
      expect(getTypeIcon(itemType)).not.toBe(FALLBACK_ICON);
      expect(getRecordRoute(itemType, 7)).toMatch(/^\/[a-z-]+\?view=7$/);
      expect(getItemTitle(itemType, {}, t)).not.toBe('search.fallbacks.record');
      expect(getItemDateWithLabel(itemType, {}, t).label).not.toBe('');
    }
  );

  it('skips a group the registry does not know', () => {
    expect(searchService.formatResultItem('unknown_things', { id: 1 })).toBe(
      null
    );
    expect(getRecordRoute('unknown_thing', 1)).toBe('/dashboard');
  });

  it('offers a tag entity for every record type except vitals', () => {
    const untaggable = SEARCH_RECORD_TYPES.filter(
      rt => !RECORD_TYPE_TO_TAG_ENTITY[rt.value]
    ).map(rt => rt.value);

    expect(untaggable).toEqual(['vitals']);
  });

  it('links text and tag search results for the same record to the same page', () => {
    const tagRows = flattenTagResults({ encounter: [{ id: 2 }] }, t);

    expect(tagRows[0].route).toBe('/visits?view=2');
    expect(getRecordRoute('encounter', 2)).toBe('/visits?view=2');
  });

  it('drops tag rows for a type without tags', () => {
    expect(flattenTagResults({ vital: [{ id: 1 }] }, t)).toEqual([]);
  });
});

describe('describeSearchItem', () => {
  it('translates with the t it is given', () => {
    const french: TFunc = key =>
      key === 'medical:bloodDonations.types.plasma' ? 'Plasma (fr)' : key;

    expect(
      describeSearchItem('blood_donation', { donation_type: 'plasma' }, french)
        .title
    ).toBe('Plasma (fr)');
  });

  it('returns Markdown as plain text; a description equal to the subtitle is dropped', () => {
    const text = describeSearchItem(
      'procedure',
      { name: 'Biopsy', description: '**Left** arm' },
      t
    );

    expect(text.subtitle).toBe('Left arm');
    expect(
      getItemDescription({ description: '**Left** arm' }, text.subtitle)
    ).toBe('');
  });

  it('keeps a description that differs from the subtitle', () => {
    const text = describeSearchItem(
      'treatment',
      { treatment_name: 'PT', status: 'active', description: 'Twice weekly' },
      t
    );

    expect(text.subtitle).toBe('active');
    expect(
      getItemDescription({ description: 'Twice weekly' }, text.subtitle)
    ).toBe('Twice weekly');
  });

  it('titles vitals from the readings', () => {
    expect(
      describeSearchItem('vital', { systolic_bp: 120, diastolic_bp: 80 }, t)
        .title
    ).toBe('BP: 120/80');
    expect(describeSearchItem('vital', {}, t).title).toBe(
      'shared:categories.vitals'
    );
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
    const row = textRow('injuries', {
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
    const row = textRow('injuries', {
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
    ).toBeNull();
    expect(getItemTitle('injury', {}, t)).toBe('search.fallbacks.injury');
  });

  it('only references search.types keys that exist in the locale files', () => {
    const searchTypeKeys = SEARCH_RECORD_TYPES.map(rt => rt.labelKey).filter(
      key => key.startsWith('search.types.')
    );
    expect(searchTypeKeys.sort()).toEqual(['search.types.encounters']);
  });

  it('links to the injuries page', () => {
    expect(getRecordRoute('injury', 3)).toBe('/injuries?view=3');
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
    const row = textRow('medical_equipment', textItem);

    expect(row).toMatchObject({
      type: 'medical_equipment',
      id: 5,
      title: 'CPAP machine',
      subtitle: 'CPAP - active',
      date: '2026-07-04',
    });
  });

  it('has no date when there is no prescribed date', () => {
    const row = textRow('medical_equipment', {
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
    expect(getRecordRoute('medical_equipment', 5)).toBe(
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
    const row = textRow('symptoms', textItem);

    expect(row).toMatchObject({
      type: 'symptom',
      id: 9,
      title: 'Dizziness',
      subtitle: 'neurological - active',
      date: '2026-08-15',
    });
  });

  it('omits missing subtitle parts without stray separators', () => {
    const row = textRow('symptoms', {
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
    expect(getRecordRoute('symptom', 9)).toBe('/symptoms?view=9');
  });
});

describe('blood donation search results', () => {
  const textItem = {
    ...textItemBase,
    id: 4,
    type: 'blood_donation',
    donation_type: 'platelets',
    location: 'City Hospital',
    donation_date: '2026-10-01',
  };
  const tagRow = {
    id: 4,
    donation_type: 'platelets',
    location: 'City Hospital',
    donation_date: '2026-10-01',
    created_at: '2026-10-02T00:00:00',
    notes: 'Felt fine',
    tags: ['regular'],
  };

  it('titles text search results with the translated donation type', () => {
    const row = textRow('blood_donations', textItem);

    expect(row).toMatchObject({
      type: 'blood_donation',
      id: 4,
      title: 'Platelets',
      subtitle: 'City Hospital',
      date: '2026-10-01',
    });
  });

  it('has an empty subtitle without a location', () => {
    const row = textRow('blood_donations', {
      ...textItem,
      location: null,
    });

    expect(row.subtitle).toBe('');
  });

  it('reads tag search rows (raw table columns) the same way', () => {
    expect(getItemTitle('blood_donation', tagRow, t)).toBe(
      'medical:bloodDonations.types.platelets'
    );
    expect(getItemSubtitle('blood_donation', tagRow, t)).toBe('City Hospital');
    expect(getItemDateWithLabel('blood_donation', tagRow, t)).toEqual({
      label: 'search.dateLabels.donated',
      value: '2026-10-01',
    });
    expect(getItemTitle('blood_donation', {}, t)).toBe(
      'search.fallbacks.donation'
    );
  });

  it('shows an unknown donation type as-is', () => {
    expect(
      getItemTitle('blood_donation', { donation_type: 'granulocytes' }, t)
    ).toBe('granulocytes');
  });

  it('links to the blood donations page', () => {
    expect(getRecordRoute('blood_donation', 4)).toBe('/blood-donations?view=4');
    expect(getTypeLabel(t, 'blood_donation')).toBe(
      'shared:categories.blood_donations'
    );
  });

  it('includes blood donations in flattened tag results', () => {
    const rows = flattenTagResults({ blood_donation: [tagRow] }, t);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'blood_donation',
      id: 4,
      route: '/blood-donations?view=4',
      _source: 'tag',
    });
  });
});

describe('sortRecordTypesByLabel', () => {
  const labels: Record<string, string> = Object.fromEntries(
    SEARCH_RECORD_TYPES.map(rt => [rt.labelKey, rt.value])
  );
  const labelOf = (key: string) => labels[key];

  it('orders record types alphabetically by translated label', () => {
    const sorted = sortRecordTypesByLabel(SEARCH_RECORD_TYPES, labelOf, 'en');
    const names = sorted.map(rt => labelOf(rt.labelKey));

    expect(names).toEqual(
      [...names].sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' })
      )
    );
    expect(names).not.toEqual(SEARCH_RECORD_TYPES.map(rt => rt.value));
  });

  it('sorts by the translated text, not the record type value', () => {
    const translated: Record<string, string> = {
      'shared:categories.allergies': 'Zebra',
      'shared:categories.medications': 'Apple',
    };
    const subset = SEARCH_RECORD_TYPES.filter(rt => rt.labelKey in translated);

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
    const subset = SEARCH_RECORD_TYPES.filter(rt => rt.labelKey in translated);

    const sorted = sortRecordTypesByLabel(subset, k => translated[k], 'fr');

    expect(sorted.map(rt => translated[rt.labelKey])).toEqual([
      'Arbre',
      'Étude',
      'Zèbre',
    ]);
  });

  it('keeps every record type and does not mutate the source list', () => {
    const before = SEARCH_RECORD_TYPES.map(rt => rt.value);

    const sorted = sortRecordTypesByLabel(SEARCH_RECORD_TYPES, labelOf, 'en');

    expect(sorted).toHaveLength(SEARCH_RECORD_TYPES.length);
    expect(sorted.map(rt => rt.value).sort()).toEqual([...before].sort());
    expect(SEARCH_RECORD_TYPES.map(rt => rt.value)).toEqual(before);
  });

  it('falls back instead of throwing on a malformed language tag', () => {
    expect(() =>
      sortRecordTypesByLabel(SEARCH_RECORD_TYPES, labelOf, 'en_US')
    ).not.toThrow();
  });
});
