export interface ImmunizationHistoryItem {
  id: number;
  patient_id: number;
  vaccine_name: string;
  vaccine_trade_name: string | null;
  date_administered: string; // YYYY-MM-DD
  dose_number: number | null;
  lot_number: string | null;
  ndc_number: string | null;
  manufacturer: string | null;
  site: string | null;
  route: string | null;
  expiration_date: string | null;
  location: string | null;
  notes: string | null;
  practitioner_id: number | null;
  tags: string[] | null;
  standardized_vaccine_id: number | null;
  components: string[];
  is_combined: boolean;
  is_library_matched: boolean;
}

export interface ImmunizationHistoryResponse {
  items: ImmunizationHistoryItem[];
  diseases_index: Record<string, number[]>;
  unmatched_count: number;
}

export type HistoryViewMode = 'byDate' | 'byDisease';
