import { describe, it, expect } from 'vitest';
import { getTemplateRowsForPanel, PANEL_TEMPLATES } from './panelTemplateMap';
import { getTestByName } from './testLibrary';

const VALID_BACKEND_CATEGORIES = new Set([
  'chemistry', 'hematology', 'hepatology', 'immunology', 'microbiology',
  'endocrinology', 'cardiology', 'toxicology', 'genetics', 'molecular',
  'pathology', 'lipids', 'hearing', 'stomatology', 'imaging', 'other',
]);

describe('getTemplateRowsForPanel', () => {
  it('returns null for unknown panel names', () => {
    expect(getTemplateRowsForPanel('Unknown Panel')).toBeNull();
    expect(getTemplateRowsForPanel('')).toBeNull();
  });

  it('returns rows for Complete Blood Count', () => {
    const rows = getTemplateRowsForPanel('Complete Blood Count');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(8);
    expect(rows![0].test_name).toBe('White Blood Cell Count');
    expect(rows![2].test_name).toBe('Hemoglobin');
  });

  it('returns rows for CBC with Differential mapping to the same template', () => {
    const cbc = getTemplateRowsForPanel('Complete Blood Count');
    const cbcDiff = getTemplateRowsForPanel('CBC with Differential');
    expect(cbcDiff).not.toBeNull();
    expect(cbcDiff!.length).toBe(cbc!.length);
    expect(cbcDiff!.map(r => r.test_name)).toEqual(cbc!.map(r => r.test_name));
  });

  it('returns rows for Basic Metabolic Panel', () => {
    const rows = getTemplateRowsForPanel('Basic Metabolic Panel');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(7);
  });

  it('returns rows for Comprehensive Metabolic Panel', () => {
    const rows = getTemplateRowsForPanel('Comprehensive Metabolic Panel');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(13);
  });

  it('returns rows for Thyroid Function Panel with endocrinology category', () => {
    const rows = getTemplateRowsForPanel('Thyroid Function Panel');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(3);
    rows!.forEach(r => expect(r.category).toBe('endocrinology'));
  });

  it('returns rows for Autoimmune Panel as qualitative', () => {
    const rows = getTemplateRowsForPanel('Autoimmune Panel');
    expect(rows).not.toBeNull();
    rows!.forEach(r => expect(r.result_type).toBe('qualitative'));
  });

  it('every returned row has a non-empty test_name (submittable)', () => {
    const panelNames = [
      'Complete Blood Count', 'Basic Metabolic Panel', 'Comprehensive Metabolic Panel',
      'Lipid Panel', 'Thyroid Function Panel', 'Hepatic Function Panel',
      'Renal Function Panel', 'Autoimmune Panel', 'PSA Panel',
    ];
    panelNames.forEach(name => {
      const rows = getTemplateRowsForPanel(name);
      expect(rows, `rows for ${name}`).not.toBeNull();
      rows!.forEach(r => expect(r.test_name.trim(), `test_name in ${name}`).not.toBe(''));
    });
  });

  it('every returned row has a backend-valid category', () => {
    const panelNames = [
      'Complete Blood Count', 'Basic Metabolic Panel', 'Comprehensive Metabolic Panel',
      'Lipid Panel', 'Thyroid Function Panel', 'Hepatic Function Panel',
      'Renal Function Panel', 'Autoimmune Panel', 'MRI', 'CT Scan', 'X-Ray', 'Ultrasound',
    ];
    panelNames.forEach(name => {
      const rows = getTemplateRowsForPanel(name);
      rows!.forEach(r =>
        expect(VALID_BACKEND_CATEGORIES.has(r.category), `category "${r.category}" in ${name}`).toBe(true)
      );
    });
  });

  it('returns PSA Panel row with Prostate Specific Antigen', () => {
    const rows = getTemplateRowsForPanel('PSA Panel');
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(1);
    expect(rows![0].test_name).toBe('Prostate Specific Antigen');
    expect(rows![0].abbreviation).toBe('PSA');
    expect(rows![0].unit).toBe('ng/mL');
    expect(rows![0].category).toBe('other');
  });

  it('returns imaging rows for MRI, CT Scan, X-Ray, Ultrasound', () => {
    const mri = getTemplateRowsForPanel('MRI');
    expect(mri).not.toBeNull();
    expect(mri!.length).toBe(1);
    expect(mri![0].test_name).toBe('MRI');
    expect(mri![0].category).toBe('imaging');
    expect(mri![0].result_type).toBe('textual');

    const ct = getTemplateRowsForPanel('CT Scan');
    expect(ct![0].test_name).toBe('CT Scan');

    const xray = getTemplateRowsForPanel('X-Ray');
    expect(xray![0].test_name).toBe('X-Ray');

    const us = getTemplateRowsForPanel('Ultrasound');
    expect(us).not.toBeNull();
    expect(us!.length).toBe(1);
    expect(us![0].test_name).toBe('Ultrasound');
    expect(us![0].abbreviation).toBe('US');
    expect(us![0].category).toBe('imaging');
    expect(us![0].result_type).toBe('textual');
  });

  it('every returned row has a unique _rowId', () => {
    const rows = getTemplateRowsForPanel('Comprehensive Metabolic Panel')!;
    const ids = rows.map(r => r._rowId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('display_order matches position in template', () => {
    const rows = getTemplateRowsForPanel('Complete Blood Count')!;
    rows.forEach((r, i) => expect(r.display_order).toBe(i + 1));
  });
});

describe('canonical_test_name linking', () => {
  it('CBC rows have canonical_test_name set to the library test_name', () => {
    const rows = getTemplateRowsForPanel('Complete Blood Count')!;
    rows.forEach(r => {
      const libraryTest = getTestByName(r.test_name);
      if (libraryTest) {
        expect(r.canonical_test_name).toBe(libraryTest.test_name);
      }
    });
  });

  it('BMP rows all have canonical_test_name populated (none null)', () => {
    const rows = getTemplateRowsForPanel('Basic Metabolic Panel')!;
    rows.forEach(r =>
      expect(r.canonical_test_name, `${r.test_name} should have canonical_test_name`).not.toBeNull()
    );
  });

  it('canonical_test_name matches test library exactly (same bucket as PDF imports)', () => {
    const panelNames = [
      'Complete Blood Count', 'Basic Metabolic Panel', 'Comprehensive Metabolic Panel',
      'Lipid Panel', 'Thyroid Function Panel', 'Hepatic Function Panel', 'Renal Function Panel',
    ];
    panelNames.forEach(name => {
      const rows = getTemplateRowsForPanel(name)!;
      rows.forEach(r => {
        const libraryTest = getTestByName(r.test_name);
        if (libraryTest) {
          expect(r.canonical_test_name).toBe(libraryTest.test_name);
        }
      });
    });
  });

  it('imaging rows without a library match have canonical_test_name null', () => {
    ['MRI', 'CT Scan', 'X-Ray', 'Ultrasound'].forEach(name => {
      const rows = getTemplateRowsForPanel(name)!;
      const libraryTest = getTestByName(rows[0].test_name);
      if (!libraryTest) {
        expect(rows[0].canonical_test_name).toBeNull();
      }
    });
  });
});

describe('PANEL_TEMPLATES', () => {
  it('all template categories are backend-valid', () => {
    PANEL_TEMPLATES.forEach(t =>
      expect(VALID_BACKEND_CATEGORIES.has(t.category), `template "${t.id}" has invalid category "${t.category}"`).toBe(true)
    );
  });

  it('no template has id custom_entry', () => {
    expect(PANEL_TEMPLATES.find(t => t.id === 'custom_entry')).toBeUndefined();
  });
});
