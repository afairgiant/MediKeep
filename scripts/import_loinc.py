#!/usr/bin/env python3
"""
LOINC Import Script
Downloads LOINC data and generates a TypeScript test library with standardized lab tests.

Requirements:
- Register at https://loinc.org to download LOINC table
- Place Loinc.csv in the scripts/ directory
- Run: python import_loinc.py

This will generate a new testLibrary.ts with LOINC-standardized tests.
"""

import csv
import json
from pathlib import Path
from typing import Dict, List, Optional

# Common lab test categories based on component/system
CATEGORY_MAPPING = {
    'WBC': 'hematology',
    'RBC': 'hematology',
    'HGB': 'hematology',
    'HCT': 'hematology',
    'PLT': 'hematology',
    'GLUC': 'chemistry',
    'CREAT': 'chemistry',
    'BUN': 'chemistry',
    'NA': 'chemistry',
    'K': 'chemistry',
    'CL': 'chemistry',
    'CO2': 'chemistry',
    'CA': 'chemistry',
    'PHOS': 'chemistry',
    'MG': 'chemistry',
    'ALB': 'chemistry',
    'TP': 'chemistry',
    'TBIL': 'chemistry',
    'AST': 'chemistry',
    'ALT': 'chemistry',
    'ALP': 'chemistry',
    'CHOL': 'lipids',
    'TRIG': 'lipids',
    'HDL': 'lipids',
    'LDL': 'lipids',
    'VLDL': 'lipids',
    'TSH': 'endocrinology',
    'T4': 'endocrinology',
    'T3': 'endocrinology',
    'TESTOST': 'endocrinology',
    'CORTIS': 'endocrinology',
    'INSUL': 'endocrinology',
    'HBA1C': 'chemistry',
    'PSA': 'other',
}

# Common tests to include (LOINC codes)
# These are the most frequently ordered tests
COMMON_TESTS = [
    # CBC with Differential
    '6690-2',   # WBC
    '789-8',    # RBC
    '718-7',    # Hemoglobin
    '4544-3',   # Hematocrit
    '787-2',    # MCV
    '785-6',    # MCH
    '786-4',    # MCHC
    '788-0',    # RDW
    '777-3',    # Platelets
    '770-8',    # Neutrophils %
    '736-9',    # Lymphocytes %
    '5905-5',   # Monocytes %
    '713-8',    # Eosinophils %
    '706-2',    # Basophils %
    '751-8',    # Neutrophils Absolute
    '731-0',    # Lymphocytes Absolute
    '742-7',    # Monocytes Absolute
    '711-2',    # Eosinophils Absolute
    '704-7',    # Basophils Absolute

    # Basic Metabolic Panel / Comprehensive Metabolic Panel
    '2345-7',   # Glucose
    '3094-0',   # BUN
    '2160-0',   # Creatinine
    '33914-3',  # eGFR
    '2951-2',   # Sodium
    '2823-3',   # Potassium
    '2075-0',   # Chloride
    '2028-9',   # CO2
    '17861-6',  # Calcium
    '2885-2',   # Protein Total
    '1751-7',   # Albumin
    '1975-2',   # Bilirubin Total
    '6768-6',   # Alkaline Phosphatase
    '1920-8',   # AST
    '1742-6',   # ALT

    # Lipid Panel
    '2093-3',   # Cholesterol Total
    '2571-8',   # Triglycerides
    '2085-9',   # HDL
    '18262-6',  # LDL Calculated
    '13457-7',  # LDL Direct

    # Thyroid
    '3016-3',   # TSH
    '3051-0',   # Free T4
    '3053-6',   # Free T3

    # Diabetes
    '4548-4',   # HbA1c

    # Hormones
    '2986-8',   # Testosterone Total
    '15067-2',  # Free Testosterone
    '2243-4',   # Estradiol
    '10501-5',  # Prolactin
    '15067-2',  # FSH
    '10501-5',  # LH

    # Vitamins
    '2132-9',   # Vitamin B12
    '2284-8',   # Folate
    '1989-3',   # Vitamin D 25-Hydroxy

    # Other Common
    '2951-2',   # PSA
    '1988-5',   # C-Reactive Protein
    '30522-7',  # C-Peptide
]


def categorize_test(component: str, system: str) -> str:
    """Determine test category based on component and system."""
    component_upper = component.upper()

    # Check component mapping
    for key, category in CATEGORY_MAPPING.items():
        if key in component_upper:
            return category

    # Check system
    if system:
        system_upper = system.upper()
        if 'BLD' in system_upper or 'BLOOD' in system_upper:
            if 'CELL' in component_upper or 'LEUK' in component_upper:
                return 'hematology'
            return 'chemistry'
        elif 'SER' in system_upper or 'PLAS' in system_upper:
            return 'chemistry'

    return 'other'


def parse_loinc_csv(csv_path: Path) -> List[Dict]:
    """Parse LOINC CSV and extract relevant lab tests."""
    tests = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            loinc_num = row.get('LOINC_NUM', '').strip()

            # Only include common tests
            if loinc_num not in COMMON_TESTS:
                continue

            component = row.get('COMPONENT', '').strip()
            system = row.get('SYSTEM', '').strip()
            shortname = row.get('SHORTNAME', '').strip()
            long_name = row.get('LONG_COMMON_NAME', '').strip()
            example_units = row.get('EXAMPLE_UNITS', '').strip()

            if not component:
                continue

            # Determine category
            category = categorize_test(component, system)

            # Build common names list
            common_names = [shortname] if shortname else []
            if long_name and long_name not in common_names:
                common_names.append(long_name)

            test = {
                'test_name': long_name or component,
                'abbreviation': shortname or None,
                'test_code': loinc_num,
                'default_unit': example_units or 'N/A',
                'category': category,
                'common_names': common_names,
                'is_common': loinc_num in COMMON_TESTS[:30],  # First 30 are most common
            }

            tests.append(test)

    return tests


def generate_typescript(tests: List[Dict], output_path: Path):
    """Generate TypeScript test library file."""

    # Sort tests by category and name
    tests_sorted = sorted(tests, key=lambda x: (x['category'], x['test_name']))

    ts_content = '''/**
 * Comprehensive Lab Test Library - LOINC Standardized
 * Auto-generated from LOINC database
 * Contains standardized test names, units, categories, and metadata
 * Used for autocomplete and auto-fill functionality
 */

export interface TestLibraryItem {
  test_name: string;
  abbreviation?: string;
  test_code?: string; // LOINC code
  default_unit: string;
  category: 'chemistry' | 'hematology' | 'lipids' | 'endocrinology' | 'immunology' | 'microbiology' | 'toxicology' | 'genetics' | 'molecular' | 'pathology' | 'other';
  common_names?: string[]; // Alternative names for fuzzy matching
  is_common: boolean; // Prioritize in suggestions
  display_order?: number;
}

export const TEST_LIBRARY: TestLibraryItem[] = [
'''

    for idx, test in enumerate(tests_sorted, 1):
        common_names_str = json.dumps(test['common_names']) if test['common_names'] else '[]'

        ts_content += f'''  {{
    test_name: "{test['test_name']}",
    abbreviation: {f'"{test["abbreviation"]}"' if test['abbreviation'] else 'undefined'},
    test_code: "{test['test_code']}",
    default_unit: "{test['default_unit']}",
    category: "{test['category']}",
    common_names: {common_names_str},
    is_common: {str(test['is_common']).lower()},
    display_order: {idx}
  }},
'''

    ts_content += '''];

// Rest of the utility functions from original file...
export const SORTED_TEST_LIBRARY = [...TEST_LIBRARY].sort((a, b) => {
  if (a.is_common && !b.is_common) return -1;
  if (!a.is_common && b.is_common) return 1;
  return a.test_name.localeCompare(b.test_name);
});

export function searchTests(query: string, limit: number = 200): TestLibraryItem[] {
  if (!query || query.trim().length === 0) {
    return SORTED_TEST_LIBRARY.slice(0, limit);
  }

  const searchTerm = query.toLowerCase().trim();

  return TEST_LIBRARY
    .map(test => {
      let score = 0;

      if (test.test_name.toLowerCase() === searchTerm || test.abbreviation?.toLowerCase() === searchTerm) {
        score = 1000;
      }
      else if (test.test_name.toLowerCase().startsWith(searchTerm) || test.abbreviation?.toLowerCase().startsWith(searchTerm)) {
        score = 500;
      }
      else if (test.test_name.toLowerCase().includes(searchTerm)) {
        score = 200;
      }
      else if (test.abbreviation?.toLowerCase().includes(searchTerm)) {
        score = 150;
      }
      else if (test.common_names?.some(name => name.toLowerCase().includes(searchTerm))) {
        score = 100;
      }

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
  const match = autocompleteValue.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : autocompleteValue.trim();
}
'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)

    print(f"✅ Generated {output_path} with {len(tests)} tests")


def main():
    """Main execution."""
    script_dir = Path(__file__).parent
    csv_path = script_dir / 'Loinc.csv'
    output_path = script_dir.parent / 'frontend' / 'src' / 'constants' / 'testLibrary.ts'

    if not csv_path.exists():
        print("❌ Error: Loinc.csv not found!")
        print("\nTo get LOINC data:")
        print("1. Register at https://loinc.org")
        print("2. Download LOINC Table (CSV format)")
        print("3. Extract and place Loinc.csv in scripts/ directory")
        print("4. Run this script again")
        return

    print("📥 Parsing LOINC CSV...")
    tests = parse_loinc_csv(csv_path)

    print(f"📊 Found {len(tests)} common lab tests")

    print("📝 Generating TypeScript library...")
    generate_typescript(tests, output_path)

    print("✅ Done! Test library updated with LOINC standards")
    print(f"\nNext steps:")
    print("1. Review {output_path}")
    print("2. Run: npm run lint (frontend)")
    print("3. Test bulk import functionality")


if __name__ == '__main__':
    main()
