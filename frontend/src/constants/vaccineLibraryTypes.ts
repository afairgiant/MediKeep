/**
 * TypeScript interfaces for the Vaccine Library.
 *
 * Matches the structure of shared/data/vaccine_library.json (WHO PreQualVaccineType
 * plus curated additions for common Western vaccines).
 */

export type VaccineCategory =
  | 'Viral'
  | 'Bacterial'
  | 'Combined'
  | 'Toxoid'
  | 'Parasitic'
  | 'Other';

export interface VaccineLibraryItem {
  who_code: string | null;
  vaccine_name: string;
  short_name: string | null;
  category: VaccineCategory;
  common_names: string[] | null;
  is_combined: boolean;
  components: string[] | null;
  default_manufacturer: string | null;
  is_common: boolean;
  display_order: number | null;
}

export interface VaccineLibraryData {
  version: string;
  lastUpdated: string;
  _source?: string;
  vaccines: VaccineLibraryItem[];
}
