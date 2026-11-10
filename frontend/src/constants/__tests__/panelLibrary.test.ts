import { describe, it, expect } from 'vitest';
import {
  PANEL_LIBRARY,
  PANEL_CATEGORY_TO_FORM_CATEGORY,
  getMatchedPanelAlias,
  getPanelAutocompleteOptions,
  getPanelByOption,
} from '../panelLibrary';
import { getTemplateRowsForPanel } from '../panelTemplateMap';
import { getTestByName } from '../testLibrary';

const PATHOLOGY_PANELS = [
  'Biopsy',
  'Bone Marrow Biopsy',
  'Cytogenetics',
  'Cytology',
  'Flow Cytometry',
  'Immunohistochemistry',
  'Molecular Pathology',
  'Pathology Report',
  'Skin Biopsy',
];

describe('pathology panels', () => {
  it('are listed when nothing has been typed, next to the imaging ones', () => {
    const options = getPanelAutocompleteOptions('', 200);
    [...PATHOLOGY_PANELS, 'MRI', 'X-Ray'].forEach(name =>
      expect(options.some(o => o.startsWith(name)), name).toBe(true)
    );
  });

  it('are all in the pathology category', () => {
    PATHOLOGY_PANELS.forEach(name => {
      expect(
        PANEL_LIBRARY.find(p => p.panel_name === name)?.category,
        name
      ).toBe('pathology');
    });
  });

  it('fill the pathology category on the lab result form', () => {
    expect(PANEL_CATEGORY_TO_FORM_CATEGORY.pathology).toBe('pathology');
    expect(PANEL_CATEGORY_TO_FORM_CATEGORY.imaging).toBe('imaging');
  });

  it('every panel in a report-style category pre-fills a template row', () => {
    PANEL_LIBRARY.filter(p => ['pathology', 'imaging'].includes(p.category)).forEach(
      p => expect(getTemplateRowsForPanel(p.panel_name), p.panel_name).not.toBeNull()
    );
  });

  it.each([
    ['biopsy', ['Biopsy', 'Bone Marrow Biopsy', 'Skin Biopsy']],
    ['pathology', ['Pathology Report']],
    ['dermatopathology', ['Skin Biopsy']],
    ['histopathology', ['Pathology Report']],
    ['BMB', ['Bone Marrow Biopsy']],
    ['pap smear', ['Cytology']],
    ['fna', ['Cytology']],
    ['ihc', ['Immunohistochemistry']],
    ['molecular', ['Molecular Pathology']],
    ['flow', ['Flow Cytometry']],
    ['karyotype', ['Cytogenetics']],
  ])('are found by typing "%s"', (query, names) => {
    const options = getPanelAutocompleteOptions(query);
    names.forEach(name =>
      expect(options.some(o => o.startsWith(name)), name).toBe(true)
    );
  });

  it('resolve from the option text the dropdown submits', () => {
    expect(getPanelByOption('Bone Marrow Biopsy (BMB)')?.panel_name).toBe(
      'Bone Marrow Biopsy'
    );
    expect(getPanelByOption('Skin Biopsy')?.category).toBe('pathology');
  });

  // Every pathology panel except the generic report has a library test of the
  // same name (used for imports and trends); typing must find the same thing
  // whichever one the dropdown resolves.
  it('carry the same abbreviation and aliases as their library test', () => {
    const paired = PANEL_LIBRARY.filter(
      p => p.category === 'pathology' && p.panel_name !== 'Pathology Report'
    );
    expect(paired.length).toBeGreaterThanOrEqual(8);
    paired.forEach(panel => {
      const test = getTestByName(panel.panel_name);
      expect(test, `library test ${panel.panel_name}`).toBeDefined();
      const lower = (names: string[] | undefined) =>
        (names ?? []).map(n => n.toLowerCase()).sort();

      expect(panel.abbreviation, panel.panel_name).toBe(test!.abbreviation ?? '');
      expect(lower(panel.common_names), panel.panel_name).toEqual(
        lower(test!.common_names)
      );
    });
  });
});

describe('panel dropdown', () => {
  // The form's name field shows at most this many options (LabResultFormWrapper
  // passes limit={50}); entries past it are cut off, not scrolled to.
  const DROPDOWN_LIMIT = 50;

  it('has room for every panel when nothing has been typed', () => {
    expect(PANEL_LIBRARY.length).toBeLessThanOrEqual(DROPDOWN_LIMIT);
    expect(getPanelAutocompleteOptions('', DROPDOWN_LIMIT)).toHaveLength(
      PANEL_LIBRARY.length
    );
  });
});

describe('getMatchedPanelAlias', () => {
  const cytology = PANEL_LIBRARY.find(p => p.panel_name === 'Cytology')!;
  const bone = PANEL_LIBRARY.find(p => p.panel_name === 'Bone Marrow Biopsy')!;

  it('returns the alias that matched', () => {
    expect(getMatchedPanelAlias(cytology, 'pap smear')).toBe('Pap Smear');
    expect(getMatchedPanelAlias(cytology, 'FNA')).toBe('FNA');
  });

  it('is case insensitive and ignores surrounding spaces', () => {
    expect(getMatchedPanelAlias(cytology, '  PAP  ')).toBe('Pap Smear');
  });

  it('returns nothing when the panel name matched', () => {
    expect(getMatchedPanelAlias(cytology, 'cyto')).toBeUndefined();
  });

  it('returns nothing when the abbreviation matched', () => {
    expect(getMatchedPanelAlias(bone, 'bmb')).toBeUndefined();
  });

  it('returns nothing for an empty query or no match', () => {
    expect(getMatchedPanelAlias(cytology, '')).toBeUndefined();
    expect(getMatchedPanelAlias(cytology, 'zzz')).toBeUndefined();
  });
});

