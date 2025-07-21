/**
 * Unit Conversion Utilities
 *
 * Provides bidirectional conversion between imperial and metric units
 * Used throughout the application for displaying and converting measurements
 */

// Weight conversions with better precision
export const convertWeight = {
  // Pounds to Kilograms
  lbsToKg: pounds => {
    if (pounds === null || pounds === undefined || pounds === '') return null;
    const numValue = parseFloat(pounds);
    if (isNaN(numValue)) return null;
    return Math.round(numValue * 0.453592 * 10) / 10; // Round to 1 decimal
  },

  // Kilograms to Pounds - store with higher precision for better round-trip accuracy
  kgToLbs: kilograms => {
    if (kilograms === null || kilograms === undefined || kilograms === '')
      return null;
    const numValue = parseFloat(kilograms);
    if (isNaN(numValue)) return null;
    return Math.round((numValue / 0.453592) * 100) / 100; // Round to 2 decimal places for better precision
  },
};

// Height conversions
export const convertHeight = {
  // Inches to Centimeters
  inchesToCm: inches => {
    if (inches === null || inches === undefined || inches === '') return null;
    return Math.round(parseFloat(inches) * 2.54 * 10) / 10; // Round to 1 decimal for consistency
  },

  // Centimeters to Inches - store with higher precision to preserve round-trip accuracy
  cmToInches: centimeters => {
    if (centimeters === null || centimeters === undefined || centimeters === '')
      return null;
    return Math.round((parseFloat(centimeters) / 2.54) * 100) / 100; // Round to 2 decimal places for better precision
  },

  // Inches to Feet and Inches display format
  inchesToFeetInches: inches => {
    if (inches === null || inches === undefined || inches === '') return null;
    const totalInches = parseFloat(inches);
    const feet = Math.floor(totalInches / 12);
    const remainingInches = Math.round((totalInches % 12) * 10) / 10;
    return `${feet}'${remainingInches}"`;
  },

  // Centimeters to Meters display format
  cmToMeters: centimeters => {
    if (centimeters === null || centimeters === undefined || centimeters === '')
      return null;
    const meters = parseFloat(centimeters) / 100;
    return `${Math.round(meters * 100) / 100}m`; // Round to 2 decimals
  },
};

// Temperature conversions
export const convertTemperature = {
  // Fahrenheit to Celsius
  fToC: fahrenheit => {
    if (fahrenheit === null || fahrenheit === undefined || fahrenheit === '')
      return null;
    return Math.round((((parseFloat(fahrenheit) - 32) * 5) / 9) * 10) / 10; // Round to 1 decimal
  },

  // Celsius to Fahrenheit
  cToF: celsius => {
    if (celsius === null || celsius === undefined || celsius === '')
      return null;
    return Math.round(((parseFloat(celsius) * 9) / 5 + 32) * 10) / 10; // Round to 1 decimal
  },
};

// Unit labels and symbols
export const unitLabels = {
  imperial: {
    weight: 'lbs',
    weightLong: 'pounds',
    height: 'inches',
    heightLong: 'inches',
    temperature: '°F',
    temperatureLong: 'Fahrenheit',
  },
  metric: {
    weight: 'kg',
    weightLong: 'kilograms',
    height: 'cm',
    heightLong: 'centimeters',
    temperature: '°C',
    temperatureLong: 'Celsius',
  },
};

// Validation ranges for different unit systems - Made consistent to avoid edge cases
export const validationRanges = {
  imperial: {
    weight: { min: 1, max: 992 }, // pounds (equivalent to 0.5-450 kg)
    height: { min: 12, max: 108 }, // inches (1 foot to 9 feet)
    temperature: { min: 70, max: 115 }, // Fahrenheit
    systolic_bp: { min: 60, max: 250 }, // mmHg (same for both systems)
    diastolic_bp: { min: 30, max: 150 }, // mmHg
    heart_rate: { min: 30, max: 250 }, // bpm
    oxygen_saturation: { min: 70, max: 100 }, // %
    respiratory_rate: { min: 8, max: 50 }, // per minute
    blood_glucose: { min: 20, max: 800 }, // mg/dL (same for both systems)
  },
  metric: {
    weight: { min: 0.5, max: 450 }, // kilograms (equivalent to 1-992 lbs)
    height: { min: 30, max: 274 }, // centimeters (equivalent to 12-108 inches)
    temperature: { min: 21, max: 46 }, // Celsius
    systolic_bp: { min: 60, max: 250 }, // mmHg (same for both systems)
    diastolic_bp: { min: 30, max: 150 }, // mmHg
    heart_rate: { min: 30, max: 250 }, // bpm
    oxygen_saturation: { min: 70, max: 100 }, // %
    respiratory_rate: { min: 8, max: 50 }, // per minute
    blood_glucose: { min: 20, max: 800 }, // mg/dL (same for both systems)
  },
};

/**
 * Convert a value from storage format (imperial) to display format based on user preference
 * @param {number|string} value - The value to convert
 * @param {string} measurementType - Type of measurement ('weight', 'height', 'temperature')
 * @param {string} unitSystem - Target unit system ('imperial' or 'metric')
 * @returns {number|null} - Converted value or null if invalid input
 */
export const convertForDisplay = (value, measurementType, unitSystem) => {
  if (value === null || value === undefined || value === '') return null;

  // Validate input is a valid number
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  // If already in imperial (storage format) and want imperial display, return as-is
  if (unitSystem === 'imperial') {
    return numValue;
  }

  // Convert from imperial (storage) to metric (display)
  switch (measurementType) {
    case 'weight':
      return convertWeight.lbsToKg(numValue);
    case 'height':
      return convertHeight.inchesToCm(numValue);
    case 'temperature':
      return convertTemperature.fToC(numValue);
    default:
      return numValue; // For measurements that don't need conversion
  }
};

/**
 * Convert a value from display format to storage format (imperial)
 * @param {number|string} value - The value to convert
 * @param {string} measurementType - Type of measurement ('weight', 'height', 'temperature')
 * @param {string} unitSystem - Source unit system ('imperial' or 'metric')
 * @returns {number|null} - Converted value or null if invalid input
 */
export const convertForStorage = (value, measurementType, unitSystem) => {
  if (value === null || value === undefined || value === '') return null;

  // Validate input is a valid number
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return null;

  // If already in imperial (storage format), return as-is
  if (unitSystem === 'imperial') {
    return numValue;
  }

  // Convert from metric (display) to imperial (storage)
  switch (measurementType) {
    case 'weight':
      return convertWeight.kgToLbs(numValue);
    case 'height':
      return convertHeight.cmToInches(numValue);
    case 'temperature':
      return convertTemperature.cToF(numValue);
    default:
      return numValue; // For measurements that don't need conversion
  }
};

/**
 * Format a measurement value for display with appropriate units
 * @param {number|string} value - The value to format
 * @param {string} measurementType - Type of measurement ('weight', 'height', 'temperature')
 * @param {string} unitSystem - Unit system ('imperial' or 'metric')
 * @param {boolean} showUnits - Whether to include unit labels (default: true)
 * @returns {string} - Formatted display string
 */
export const formatMeasurement = (
  value,
  measurementType,
  unitSystem,
  showUnits = true
) => {
  if (value === null || value === undefined || value === '') return '--';

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return '--';

  // Validate inputs
  if (!unitLabels[unitSystem]) return '--';

  let formattedValue;

  // Special formatting for height
  if (measurementType === 'height') {
    if (unitSystem === 'imperial') {
      formattedValue = convertHeight.inchesToFeetInches(numValue);
      return formattedValue || '--'; // Already includes formatting
    } else {
      formattedValue = convertHeight.cmToMeters(numValue);
      return formattedValue || '--'; // Already includes formatting
    }
  }

  // Standard formatting for other measurements
  if (measurementType === 'weight' || measurementType === 'temperature') {
    formattedValue = Math.round(numValue * 10) / 10; // 1 decimal place
  } else {
    formattedValue = Math.round(numValue); // Whole numbers
  }

  if (!showUnits) {
    return formattedValue.toString();
  }

  const unit = unitLabels[unitSystem][measurementType] || '';
  return `${formattedValue} ${unit}`;
};
