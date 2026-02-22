/**
 * TypeScript interfaces for the Test Library
 *
 * These types match the structure of shared/data/test_library.json
 */

// All valid test categories
// This includes categories used in test_library.json and additional categories
// supported by the backend for lab test components
export type TestCategory =
  | 'chemistry'
  | 'hematology'
  | 'hepatology'
  | 'lipids'
  | 'endocrinology'
  | 'cardiology'
  | 'immunology'
  | 'microbiology'
  | 'toxicology'
  | 'genetics'
  | 'molecular'
  | 'pathology'
  | 'hearing'
  | 'stomatology'
  | 'other';

export type ResultType = 'quantitative' | 'qualitative';
export type QualitativeValue = 'positive' | 'negative' | 'detected' | 'undetected';

export interface TestLibraryItem {
  test_name: string;
  abbreviation?: string;
  test_code?: string;
  default_unit: string;
  category: TestCategory;
  common_names?: string[];
  is_common: boolean;
  display_order?: number;
  result_type?: ResultType;
}

export interface TestLibraryData {
  version: string;
  lastUpdated: string;
  tests: TestLibraryItem[];
}
