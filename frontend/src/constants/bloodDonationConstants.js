/**
 * Blood Donation Constants
 *
 * Donation types and default minimum intervals (days). The defaults must stay
 * in sync with DEFAULT_DONATION_INTERVALS in
 * app/services/blood_donation_eligibility.py.
 */

export const DONATION_TYPES = [
  'whole_blood',
  'plasma',
  'platelets',
  'double_red_cells',
];

export const DEFAULT_DONATION_INTERVALS = {
  whole_blood: 56,
  plasma: 14,
  platelets: 14,
  double_red_cells: 112,
};

// Valid range (inclusive) for a per-type donation interval, in days. Mirrors
// the backend's blood_donation_intervals validation (1-365, strict ints).
export const INTERVAL_DAYS_RANGE = { min: 1, max: 365 };

// Pre-donation screening value ranges (unit-system independent). Shared by
// BloodDonationFormWrapper's NumberInput min/max and the BloodDonations
// page's pre-submit validation.
export const SCREENING_RANGES = {
  systolic_bp: { min: 60, max: 250 },
  diastolic_bp: { min: 30, max: 150 },
  hemoglobin: { min: 3, max: 25 },
};

const DONATION_TYPE_FALLBACK_LABELS = {
  whole_blood: 'Whole Blood',
  plasma: 'Plasma',
  platelets: 'Platelets',
  double_red_cells: 'Double Red Cells',
};

const DONATION_TYPE_COLORS = {
  whole_blood: 'red',
  plasma: 'yellow',
  platelets: 'orange',
  double_red_cells: 'grape',
};

export const getDonationTypeLabel = (type, t) => {
  if (!type) return '';
  const fallback = DONATION_TYPE_FALLBACK_LABELS[type];
  if (!fallback) return type;
  return t(`medical:bloodDonations.types.${type}`, fallback);
};

export const getDonationTypeOptions = t =>
  DONATION_TYPES.map(value => ({
    value,
    label: getDonationTypeLabel(value, t),
  }));

export const getDonationTypeColor = type =>
  DONATION_TYPE_COLORS[type] || 'gray';
