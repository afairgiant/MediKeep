#!/usr/bin/env python3
"""
Comprehensive LOINC Import Script
Imports ALL types of medical tests from LOINC database.

Supports:
- Lab tests (blood work, urinalysis, cultures)
- EKG/ECG measurements and interpretations
- Radiology/Imaging reports
- Pathology/Biopsy results
- Cardiac procedures and stress tests
- Pulmonary function tests
- And more...

Requirements:
- Download LOINC from https://loinc.org
- Place Loinc.csv in _working/ directory
- Run: python scripts/import_loinc_comprehensive.py
"""

import csv
import json
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict

# Map LOINC CLASS to MediKeep category
CLASS_TO_CATEGORY = {
    # Hematology - Blood cell counts and coagulation
    'HEM/BC': 'hematology',
    'COAG': 'hematology',
    'SERO': 'hematology',

    # Chemistry - Metabolic panels, enzymes, proteins
    'CHEM': 'chemistry',
    'DRUG/TOX': 'toxicology',

    # Lipids - Cholesterol and lipid panels
    'CHOL/LIPIDS': 'lipids',

    # Endocrinology - Hormones
    'ENDO': 'endocrinology',
    'REPRODUCTIVE': 'endocrinology',

    # Microbiology - Cultures, sensitivities
    'MICRO': 'microbiology',
    'ABXBACT': 'microbiology',

    # Immunology - Antibodies, immune markers
    'ALLERGY': 'immunology',
    'IMMU': 'immunology',

    # Molecular/Genetics
    'MOLPATH': 'genetics',
    'MOLPATH.PHARMG': 'genetics',
    'CYTO': 'genetics',

    # Pathology - Tissue/cell analysis
    'PATH': 'pathology',
    'PATH.HISTO': 'pathology',
    'PATH.PROTOCOLS.BRST': 'pathology',
    'PATH.PROTOCOLS.GENER': 'pathology',
    'PATH.PROTOCOLS.PROST': 'pathology',
    'PATH.PROTOCOLS.SKIN': 'pathology',

    # Cardiology - EKG, cardiac tests
    'EKG.ATOM': 'cardiology',
    'EKG.IMP': 'cardiology',
    'EKG.MEAS': 'cardiology',
    'CARD.PROC': 'cardiology',
    'CARD.US': 'cardiology',
    'CARDIAC': 'cardiology',
    'ECHO': 'cardiology',

    # Radiology - Imaging
    'RAD': 'radiology',
    'US': 'radiology',
    'CT': 'radiology',
    'MRI': 'radiology',
    'XRAY': 'radiology',

    # Pulmonary
    'PULM': 'pulmonary',
    'RESP': 'pulmonary',

    # Urinalysis
    'UA': 'urinalysis',

    # Other
    'PANEL': 'other',  # Will be categorized by panel type
}

# Friendly name mappings for common tests (LOINC code -> friendly common names)
FRIENDLY_NAMES = {
    # Hematology
    '6690-2': ['WBC', 'White Blood Cells', 'Leukocytes'],
    '789-8': ['RBC', 'Red Blood Cells', 'Erythrocytes'],
    '718-7': ['Hemoglobin', 'HGB', 'Hb'],
    '4544-3': ['Hematocrit', 'HCT', 'Hct'],
    '777-3': ['Platelets', 'PLT', 'Platelet Count'],
    '787-2': ['MCV', 'Mean Corpuscular Volume'],
    '785-6': ['MCH', 'Mean Corpuscular Hemoglobin'],
    '786-4': ['MCHC'],
    '788-0': ['RDW'],
    '770-8': ['Neutrophils', 'Neut'],
    '736-9': ['Lymphocytes', 'Lymph'],
    '5905-5': ['Monocytes', 'Mono'],
    '713-8': ['Eosinophils', 'Eos'],
    '706-2': ['Basophils', 'Baso'],
    '5902-2': ['PT', 'Prothrombin Time'],
    '6301-6': ['INR'],
    '3173-2': ['PTT', 'Partial Thromboplastin Time'],

    # Chemistry
    '2345-7': ['Glucose', 'Blood Sugar'],
    '3094-0': ['BUN', 'Blood Urea Nitrogen'],
    '2160-0': ['Creatinine', 'Creat'],
    '2951-2': ['Sodium', 'Na'],
    '2823-3': ['Potassium', 'K'],
    '2075-0': ['Chloride', 'Cl'],
    '2028-9': ['CO2', 'Carbon Dioxide', 'Bicarbonate'],
    '17861-6': ['Calcium', 'Ca'],
    '1742-6': ['ALT', 'SGPT'],
    '1920-8': ['AST', 'SGOT'],
    '6768-6': ['Alkaline Phosphatase', 'ALP', 'Alk Phos'],
    '1975-2': ['Total Bilirubin', 'Bilirubin'],
    '1968-7': ['Direct Bilirubin'],
    '1751-7': ['Albumin'],
    '2885-2': ['Total Protein', 'Protein'],
    '10834-0': ['Globulin'],
    '1759-0': ['A/G Ratio', 'Albumin/Globulin Ratio'],

    # Lipids
    '2093-3': ['Total Cholesterol', 'Cholesterol'],
    '2571-8': ['Triglycerides', 'Trig'],
    '2085-9': ['HDL', 'HDL Cholesterol', 'Good Cholesterol'],
    '13457-7': ['LDL Calculated', 'LDL', 'LDL Cholesterol', 'Bad Cholesterol'],
    '13458-5': ['VLDL Calculated', 'VLDL'],
    '9830-1': ['Cholesterol/HDL Ratio'],

    # Endocrinology
    '3016-3': ['TSH', 'Thyroid Stimulating Hormone'],
    '3051-0': ['Free T4', 'FT4'],
    '3053-6': ['Free T3', 'FT3'],
    '3026-2': ['Total T4', 'T4'],
    '3053-6': ['Total T3', 'T3'],
    '4548-4': ['HbA1c', 'Hemoglobin A1c', 'A1C'],
    '15067-2': ['FSH', 'Follicle Stimulating Hormone'],
    '10501-5': ['LH', 'Luteinizing Hormone'],
    '2243-4': ['Testosterone', 'Total Testosterone'],
    '2990-0': ['Estradiol'],
    '2746-6': ['Progesterone'],
    '2986-8': ['Testosterone Free', 'Free Testosterone'],
    '1558-6': ['Fasting Glucose'],
    '1547-9': ['IGF-1'],
    '2132-9': ['Vitamin B12', 'B12'],
    '2284-8': ['Folate', 'Folic Acid'],
    '1989-3': ['Vitamin D', '25-OH Vitamin D'],

    # Urinalysis
    '5811-5': ['Specific Gravity'],
    '5803-2': ['pH'],
    '5804-0': ['Protein'],
    '5802-4': ['Glucose'],
    '5794-3': ['Hemoglobin'],
    '5799-2': ['Ketones'],
    '5797-6': ['Bilirubin'],
    '5792-7': ['Urobilinogen'],

    # Cardiology
    '33762-6': ['BNP', 'B-type Natriuretic Peptide'],
    '33763-4': ['NT-proBNP'],
    '10839-9': ['Troponin I'],
    '6598-7': ['Troponin T'],
}

# Most common tests by LOINC code
COMMON_TESTS_BY_TYPE = {
    'hematology': [
        '6690-2', '789-8', '718-7', '4544-3', '787-2', '785-6', '786-4', '788-0', '777-3',
        '770-8', '736-9', '5905-5', '713-8', '706-2', '751-8', '731-0', '742-7', '711-2', '704-7',
        '5902-2',  # PT
        '6301-6',  # INR
        '3173-2',  # PTT
    ],
    'chemistry': [
        '2345-7', '3094-0', '2160-0', '33914-3', '2951-2', '2823-3', '2075-0', '2028-9',
        '17861-6', '2885-2', '1751-7', '1975-2', '6768-6', '1920-8', '1742-6',
        '2532-0',  # LDH
        '2157-6',  # CK
        '2532-0',  # Lactate
        '1988-5',  # CRP
    ],
    'lipids': [
        '2093-3', '2571-8', '2085-9', '18262-6', '13457-7', '22748-8',
    ],
    'endocrinology': [
        '3016-3', '3051-0', '3053-6', '2986-8', '15067-2', '2243-4',
        '10501-5', '15067-2', '2639-3',  # Insulin
        '1986-9',  # Cortisol
    ],
    'urinalysis': [
        '5811-5',  # Specific gravity
        '5803-2',  # pH
        '5804-0',  # Protein
        '5792-7',  # Glucose
        '5799-2',  # Ketones
        '5794-3',  # Hemoglobin/Blood
        '5802-4',  # Nitrite
        '5821-4',  # Leukocyte esterase
    ],
    'cardiology': [
        '8625-6',  # P-R interval
        '8633-0',  # QRS duration
        '8634-8',  # QT interval
        '8636-3',  # QT corrected
        '8625-6',  # Heart rate
        '10331-7', # Troponin I
        '49563-0', # Troponin T
        '30934-4', # BNP
        '33762-6', # NT-proBNP
    ],
    'radiology': [
        '24531-6', # Chest X-ray
        '30746-2', # CT Head
        '24727-0', # MRI Brain
        '26356-7', # Ultrasound Abdomen
    ],
    'pathology': [
        '33717-0', # Biopsy report
        '22634-0', # Surgical pathology
    ],
}

def get_category_from_class(loinc_class: str) -> str:
    """Determine category from LOINC CLASS field."""
    if not loinc_class:
        return 'other'

    # Direct match
    if loinc_class in CLASS_TO_CATEGORY:
        return CLASS_TO_CATEGORY[loinc_class]

    # Partial match
    for class_prefix, category in CLASS_TO_CATEGORY.items():
        if loinc_class.startswith(class_prefix):
            return category

    # Check for panel types
    if 'PANEL' in loinc_class:
        for key in CLASS_TO_CATEGORY:
            if key in loinc_class:
                return CLASS_TO_CATEGORY[key]

    return 'other'

def is_common_test(loinc_num: str, category: str) -> bool:
    """Check if test is in the common tests list."""
    if category in COMMON_TESTS_BY_TYPE:
        return loinc_num in COMMON_TESTS_BY_TYPE[category]
    return False

def parse_loinc_csv(csv_path: Path) -> List[Dict]:
    """Parse LOINC CSV and extract tests by type."""
    tests = []
    categories_count = defaultdict(int)

    # Collect all common test codes
    all_common_codes = set()
    for codes in COMMON_TESTS_BY_TYPE.values():
        all_common_codes.update(codes)

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            loinc_num = row.get('LOINC_NUM', '').strip()

            # Only include common tests
            if loinc_num not in all_common_codes:
                continue

            component = row.get('COMPONENT', '').strip()
            system = row.get('SYSTEM', '').strip()
            loinc_class = row.get('CLASS', '').strip()
            shortname = row.get('SHORTNAME', '').strip()
            long_name = row.get('LONG_COMMON_NAME', '').strip()
            example_units = row.get('EXAMPLE_UNITS', '').strip()
            consumer_name = row.get('CONSUMER_NAME', '').strip()

            if not component:
                continue

            # Determine category
            category = get_category_from_class(loinc_class)
            categories_count[category] += 1

            # Build common names list - start with friendly names if available
            common_names = []

            # Add friendly names first (these are the names used in real lab reports)
            if loinc_num in FRIENDLY_NAMES:
                common_names.extend(FRIENDLY_NAMES[loinc_num])

            # Then add LOINC official names
            if shortname and shortname not in common_names:
                common_names.append(shortname)
            if consumer_name and consumer_name not in common_names:
                common_names.append(consumer_name)
            if long_name and long_name not in common_names:
                common_names.append(long_name)

            # Use friendly name as display name if available, otherwise consumer name
            if loinc_num in FRIENDLY_NAMES:
                display_name = FRIENDLY_NAMES[loinc_num][0]  # First friendly name is primary
            else:
                display_name = consumer_name or long_name or component

            test = {
                'test_name': display_name,
                'abbreviation': shortname or None,
                'test_code': loinc_num,
                'default_unit': example_units or 'N/A',
                'category': category,
                'common_names': common_names if common_names else None,
                'is_common': is_common_test(loinc_num, category),
                'loinc_class': loinc_class,  # Keep for reference
            }

            tests.append(test)

    # Print summary
    print(f"\n[*] Test Distribution by Category:")
    for cat in sorted(categories_count.keys()):
        print(f"  {cat}: {categories_count[cat]}")

    return tests

def generate_typescript(tests: List[Dict], output_path: Path):
    """Generate TypeScript test library file."""

    # Sort tests by category and name
    tests_sorted = sorted(tests, key=lambda x: (x['category'], x['test_name']))

    ts_content = '''/**
 * Comprehensive Medical Test Library - LOINC Standardized
 * Auto-generated from LOINC database
 *
 * Includes:
 * - Lab tests (blood work, urinalysis, cultures)
 * - Cardiology (EKG, troponins, BNP)
 * - Radiology (imaging reports)
 * - Pathology (biopsy results)
 * - And more...
 */

export interface TestLibraryItem {
  test_name: string;
  abbreviation?: string;
  test_code?: string; // LOINC code
  default_unit: string;
  category: 'chemistry' | 'hematology' | 'lipids' | 'endocrinology' | 'immunology' | 'microbiology' |
            'toxicology' | 'genetics' | 'molecular' | 'pathology' | 'cardiology' | 'radiology' |
            'pulmonary' | 'urinalysis' | 'other';
  common_names?: string[]; // Alternative names for fuzzy matching
  is_common: boolean; // Prioritize in suggestions
  display_order?: number;
}

export const TEST_LIBRARY: TestLibraryItem[] = [
'''

    for idx, test in enumerate(tests_sorted, 1):
        abbrev = f'"{test["abbreviation"]}"' if test['abbreviation'] else 'undefined'
        common_names_str = json.dumps(test['common_names']) if test['common_names'] else 'undefined'

        ts_content += f'''  {{
    test_name: "{test['test_name']}",
    abbreviation: {abbrev},
    test_code: "{test['test_code']}",
    default_unit: "{test['default_unit']}",
    category: "{test['category']}",
    common_names: {common_names_str},
    is_common: {str(test['is_common']).lower()},
    display_order: {idx}
  }},
'''

    # Add utility functions
    ts_content += '''];

// Pre-sorted for performance
export const SORTED_TEST_LIBRARY = [...TEST_LIBRARY].sort((a, b) => {
  if (a.is_common && !b.is_common) return -1;
  if (!a.is_common && b.is_common) return 1;
  return a.test_name.localeCompare(b.test_name);
});

/**
 * Search tests by name, abbreviation, or common names
 * Supports fuzzy matching for better UX
 */
export function searchTests(query: string, limit: number = 200): TestLibraryItem[] {
  if (!query || query.trim().length === 0) {
    return SORTED_TEST_LIBRARY.slice(0, limit);
  }

  const searchTerm = query.toLowerCase().trim();

  return TEST_LIBRARY
    .map(test => {
      let score = 0;

      // Exact match on test name or abbreviation (highest priority)
      if (test.test_name.toLowerCase() === searchTerm || test.abbreviation?.toLowerCase() === searchTerm) {
        score = 1000;
      }
      // Starts with query
      else if (test.test_name.toLowerCase().startsWith(searchTerm) || test.abbreviation?.toLowerCase().startsWith(searchTerm)) {
        score = 500;
      }
      // Contains query in test name
      else if (test.test_name.toLowerCase().includes(searchTerm)) {
        score = 200;
      }
      // Contains query in abbreviation
      else if (test.abbreviation?.toLowerCase().includes(searchTerm)) {
        score = 150;
      }
      // Match common names
      else if (test.common_names?.some(name => name.toLowerCase().includes(searchTerm))) {
        score = 100;
      }

      // Boost score for common tests
      if (test.is_common && score > 0) {
        score += 50;
      }

      return { test, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.test.test_name.localeCompare(b.test.test_name);
    })
    .slice(0, limit)
    .map(result => result.test);
}

export function getTestByName(testName: string): TestLibraryItem | undefined {
  return TEST_LIBRARY.find(
    test => test.test_name.toLowerCase() === testName.toLowerCase() ||
            test.abbreviation?.toLowerCase() === testName.toLowerCase()
  );
}

export function getAutocompleteOptions(query: string = '', limit: number = 200): string[] {
  const tests = searchTests(query, limit);
  return tests.map(test => {
    if (test.abbreviation) {
      return `${test.test_name} (${test.abbreviation})`;
    }
    return test.test_name;
  });
}

export function extractTestName(autocompleteValue: string): string {
  const match = autocompleteValue.match(/^(.+?)\\s*\\(/);
  return match ? match[1].trim() : autocompleteValue.trim();
}
'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)

    print(f"[OK] Generated {output_path} with {len(tests)} tests")

def main():
    """Main execution."""
    script_dir = Path(__file__).parent
    csv_path = script_dir.parent / '_working' / 'Loinc.csv'
    output_path = script_dir.parent / 'frontend' / 'src' / 'constants' / 'testLibrary.ts'

    if not csv_path.exists():
        print("[X] Error: Loinc.csv not found!")
        print(f"\nExpected location: {csv_path}")
        print("\nTo get LOINC data:")
        print("1. Register at https://loinc.org")
        print("2. Download LOINC Table (CSV format)")
        print("3. Extract and place Loinc.csv in _working/ directory")
        print("4. Run this script again")
        return

    print("[*] Parsing LOINC CSV (108K+ entries)...")
    tests = parse_loinc_csv(csv_path)

    print(f"\n[OK] Extracted {len(tests)} common medical tests")

    print("\n[*] Generating TypeScript library...")
    generate_typescript(tests, output_path)

    print("\n[OK] Done! Test library updated with comprehensive LOINC standards")
    print(f"\nIncludes:")
    print("  - Lab tests (hematology, chemistry, lipids)")
    print("  - Cardiology (EKG, troponins, cardiac markers)")
    print("  - Radiology (imaging reports)")
    print("  - Pathology (biopsy results)")
    print("  - Urinalysis")
    print("  - Endocrinology (hormones)")
    print("  - And more...")
    print(f"\nNext steps:")
    print("1. Review {output_path}")
    print("2. Run: cd frontend && npm run lint")
    print("3. Test bulk import with various PDF types")

if __name__ == '__main__':
    main()
