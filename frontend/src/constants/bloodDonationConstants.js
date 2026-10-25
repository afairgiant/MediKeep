// Defaults must match DEFAULT_DONATION_INTERVALS in app/services/blood_donation_eligibility.py.

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

// Mirrors the backend interval validation (days, inclusive).
export const INTERVAL_DAYS_RANGE = { min: 1, max: 365 };

// Unit-system independent; used by the form inputs and the page's pre-submit validation.
export const SCREENING_RANGES = {
  systolic_bp: { min: 60, max: 250 },
  diastolic_bp: { min: 30, max: 150 },
  hemoglobin: { min: 3, max: 25 },
};

// Hemoglobin is stored in g/dL; the user's unit is applied on input and display.
// Factors must match app/services/blood_donation_units.py.
export const HEMOGLOBIN_UNITS = ['g_dl', 'g_l', 'mmol_l'];
export const DEFAULT_HEMOGLOBIN_UNIT = 'g_dl';

export const HEMOGLOBIN_UNIT_LABELS = {
  g_dl: 'g/dL',
  g_l: 'g/L',
  mmol_l: 'mmol/L',
};

const HEMOGLOBIN_FROM_G_DL = { g_dl: 1, g_l: 10, mmol_l: 0.6206 };
const HEMOGLOBIN_DECIMALS = { g_dl: 1, g_l: 0, mmol_l: 1 };

const resolveHemoglobinUnit = unit =>
  HEMOGLOBIN_UNITS.includes(unit) ? unit : DEFAULT_HEMOGLOBIN_UNIT;

const roundTo = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const convertHemoglobinForDisplay = (valueGdl, unit) => {
  if (valueGdl === null || valueGdl === undefined || valueGdl === '')
    return null;
  const resolved = resolveHemoglobinUnit(unit);
  return roundTo(
    Number(valueGdl) * HEMOGLOBIN_FROM_G_DL[resolved],
    HEMOGLOBIN_DECIMALS[resolved]
  );
};

export const convertHemoglobinForStorage = (value, unit) => {
  if (value === null || value === undefined || value === '') return null;
  return roundTo(
    Number(value) / HEMOGLOBIN_FROM_G_DL[resolveHemoglobinUnit(unit)],
    2
  );
};

// Rounded inwards so a value at either edge still converts back into the stored range.
export const getHemoglobinRange = unit => {
  const resolved = resolveHemoglobinUnit(unit);
  const factor = 10 ** HEMOGLOBIN_DECIMALS[resolved];
  const scale = HEMOGLOBIN_FROM_G_DL[resolved];
  return {
    min: Math.ceil(SCREENING_RANGES.hemoglobin.min * scale * factor) / factor,
    max: Math.floor(SCREENING_RANGES.hemoglobin.max * scale * factor) / factor,
  };
};

export const getHemoglobinDecimals = unit =>
  HEMOGLOBIN_DECIMALS[resolveHemoglobinUnit(unit)];

export const getHemoglobinUnitLabel = unit =>
  HEMOGLOBIN_UNIT_LABELS[resolveHemoglobinUnit(unit)];

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
