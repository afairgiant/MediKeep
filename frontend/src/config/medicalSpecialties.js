/**
 * Medical Specialties Configuration
 * Centralized configuration for medical specialties used throughout the application
 */

import apiService from '../services/api';
import logger from '../services/logger';

// Default medical specialties with descriptions
// This serves as a fallback when API is unavailable or for initial load
export const DEFAULT_MEDICAL_SPECIALTIES = [
  // Traditional Medical Specialties
  {
    value: 'Anesthesiology',
    label: 'Anesthesiology - Pain management & anesthesia',
  },
  { value: 'Cardiology', label: 'Cardiology - Heart & cardiovascular system' },
  { value: 'Dermatology', label: 'Dermatology - Skin, hair & nails' },
  { value: 'Emergency Medicine', label: 'Emergency Medicine - Emergency care' },
  { value: 'Endocrinology', label: 'Endocrinology - Hormones & glands' },
  { value: 'Family Medicine', label: 'Family Medicine - General practice' },
  { value: 'Gastroenterology', label: 'Gastroenterology - Digestive system' },
  { value: 'General Surgery', label: 'General Surgery - Surgical procedures' },
  {
    value: 'Internal Medicine',
    label: 'Internal Medicine - Internal organ systems',
  },
  { value: 'Neurology', label: 'Neurology - Brain & nervous system' },
  { value: 'Obstetrics and Gynecology', label: "OB/GYN - Women's health" },
  { value: 'Oncology', label: 'Oncology - Cancer treatment' },
  { value: 'Ophthalmology', label: 'Ophthalmology - Eye care' },
  {
    value: 'Otorhinolaryngology',
    label: 'Otorhinolaryngology (ENT) - Ear, nose & throat',
  },
  { value: 'Orthopedics', label: 'Orthopedics - Bone & joint care' },
  { value: 'Pathology', label: 'Pathology - Disease diagnosis' },
  { value: 'Pediatrics', label: "Pediatrics - Children's health" },
  { value: 'Psychiatry', label: 'Psychiatry - Mental health' },
  { value: 'Radiology', label: 'Radiology - Medical imaging' },
  {
    value: 'Rheumatology',
    label: 'Rheumatology - Autoimmune & joint diseases',
  },
  { value: 'Urology', label: 'Urology - Urinary system' },

  // Dental Specialties (NEW - requested by user)
  { value: 'Dentistry', label: 'Dentistry - General dental care' },
  {
    value: 'Oral and Maxillofacial Surgery',
    label: 'Oral & Maxillofacial Surgery - Surgical dental procedures',
  },
  { value: 'Orthodontics', label: 'Orthodontics - Teeth alignment & braces' },
  { value: 'Periodontics', label: 'Periodontics - Gum disease treatment' },
  { value: 'Endodontics', label: 'Endodontics - Root canal therapy' },
  {
    value: 'Prosthodontics',
    label: 'Prosthodontics - Dental prosthetics & implants',
  },
  {
    value: 'Pediatric Dentistry',
    label: "Pediatric Dentistry - Children's dental care",
  },

  // Additional Specialties
  {
    value: 'Allergy and Immunology',
    label: 'Allergy & Immunology - Immune system & allergies',
  },
  {
    value: 'Infectious Disease',
    label: 'Infectious Disease - Infection treatment',
  },
  { value: 'Nephrology', label: 'Nephrology - Kidney care' },
  { value: 'Pulmonology', label: 'Pulmonology - Lung & respiratory care' },
  { value: 'Hematology', label: 'Hematology - Blood disorders' },
  {
    value: 'Physical Medicine and Rehabilitation',
    label: 'PM&R - Physical rehabilitation',
  },
  {
    value: 'Nuclear Medicine',
    label: 'Nuclear Medicine - Radioactive diagnostics',
  },
  { value: 'Medical Genetics', label: 'Medical Genetics - Genetic disorders' },
  {
    value: 'Preventive Medicine',
    label: 'Preventive Medicine - Disease prevention',
  },

  // Allied Health Professionals
  { value: 'Podiatry', label: 'Podiatry - Foot & ankle care' },
  {
    value: 'Chiropractic',
    label: 'Chiropractic - Spinal adjustment & musculoskeletal care',
  },
  {
    value: 'Physical Therapy',
    label: 'Physical Therapy - Movement & rehabilitation',
  },
  {
    value: 'Occupational Therapy',
    label: 'Occupational Therapy - Daily living skills',
  },
  {
    value: 'Speech Therapy',
    label: 'Speech Therapy - Speech & language disorders',
  },
  { value: 'Nutrition', label: 'Nutrition - Dietary counseling' },
  { value: 'Psychology', label: 'Psychology - Mental health counseling' },
  { value: 'Optometry', label: 'Optometry - Vision care & eye exams' },
  { value: 'Audiology', label: 'Audiology - Hearing & balance disorders' },

  // Surgical Subspecialties
  { value: 'Neurosurgery', label: 'Neurosurgery - Brain & spine surgery' },
  { value: 'Cardiac Surgery', label: 'Cardiac Surgery - Heart surgery' },
  {
    value: 'Vascular Surgery',
    label: 'Vascular Surgery - Blood vessel surgery',
  },
  {
    value: 'Plastic Surgery',
    label: 'Plastic Surgery - Reconstructive & cosmetic surgery',
  },
  { value: 'Thoracic Surgery', label: 'Thoracic Surgery - Chest surgery' },
  {
    value: 'Colorectal Surgery',
    label: 'Colorectal Surgery - Colon & rectal surgery',
  },
  {
    value: 'Transplant Surgery',
    label: 'Transplant Surgery - Organ transplantation',
  },
];

// Cache for fetched specialties
let specialtiesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch medical specialties from the API
 * Falls back to default list if API is unavailable
 */
export const fetchMedicalSpecialties = async () => {
  try {
    // Initialize custom specialties on first run
    initializeCustomSpecialties();

    // Check cache first
    if (
      specialtiesCache &&
      cacheTimestamp &&
      Date.now() - cacheTimestamp < CACHE_DURATION
    ) {
      return specialtiesCache;
    }

    // Try to fetch from API (but don't fail if it doesn't work)
    try {
      const response = await apiService.get('/practitioners/specialties');

      if (
        response &&
        response.specialties &&
        Array.isArray(response.specialties)
      ) {
        // Merge API specialties with defaults, removing duplicates
        const apiSpecialties = response.specialties.map(specialty => {
          // Check if this specialty exists in defaults to get description
          const defaultSpec = DEFAULT_MEDICAL_SPECIALTIES.find(
            s => s.value.toLowerCase() === specialty.toLowerCase()
          );

          if (defaultSpec) {
            return defaultSpec;
          }

          // For custom specialties not in defaults, create basic format
          return {
            value: specialty,
            label: specialty,
            isCustom: true,
          };
        });

        // Combine and deduplicate
        const allSpecialties = [...DEFAULT_MEDICAL_SPECIALTIES];

        apiSpecialties.forEach(apiSpec => {
          if (
            !allSpecialties.find(
              s => s.value.toLowerCase() === apiSpec.value.toLowerCase()
            )
          ) {
            allSpecialties.push(apiSpec);
          }
        });

        // Sort alphabetically by value
        allSpecialties.sort((a, b) => a.value.localeCompare(b.value));

        // Add "Other" option at the end
        allSpecialties.push({
          value: 'Other',
          label: 'Other - Specify in notes',
          isOther: true,
        });

        // Update cache
        specialtiesCache = allSpecialties;
        cacheTimestamp = Date.now();

        logger.debug(
          'medical_specialties_fetched',
          'Successfully fetched medical specialties',
          {
            component: 'medicalSpecialties',
            count: allSpecialties.length,
          }
        );

        return allSpecialties;
      }
    } catch (apiError) {
      // API call failed, but that's okay - we'll use defaults
      logger.warn(
        'medical_specialties_api_unavailable',
        'API unavailable, using default specialties',
        {
          component: 'medicalSpecialties',
          error: apiError.message,
        }
      );
    }
  } catch (error) {
    logger.error(
      'medical_specialties_unexpected_error',
      'Unexpected error in fetchMedicalSpecialties',
      {
        component: 'medicalSpecialties',
        error: error.message,
      }
    );
  }

  // Always return defaults with any cached custom specialties as fallback
  // Get any custom specialties from localStorage (fallback when API fails)
  let customSpecialties = [];
  try {
    const stored = localStorage.getItem('customMedicalSpecialties');
    if (stored) {
      customSpecialties = JSON.parse(stored);
    }
  } catch (e) {
    logger.debug(
      'custom_specialties_localStorage_error',
      'Failed to load from localStorage',
      {
        component: 'medicalSpecialties',
      }
    );
  }

  // Combine defaults with custom specialties
  const allSpecialties = [...DEFAULT_MEDICAL_SPECIALTIES];

  // Add custom specialties
  customSpecialties.forEach(customSpec => {
    if (
      !allSpecialties.find(
        s => s.value.toLowerCase() === customSpec.toLowerCase()
      )
    ) {
      allSpecialties.push({
        value: customSpec,
        label: customSpec,
        isCustom: true,
      });
    }
  });

  // Sort alphabetically
  const sortedDefaults = allSpecialties.sort((a, b) =>
    a.value.localeCompare(b.value)
  );

  // Add Other option at the end
  sortedDefaults.push({
    value: 'Other',
    label: 'Other - Specify in notes',
    isOther: true,
  });

  // Cache the sorted defaults
  specialtiesCache = sortedDefaults;
  cacheTimestamp = Date.now();

  return sortedDefaults;
};

/**
 * Clear the specialties cache
 * Useful when adding new custom specialties
 */
export const clearSpecialtiesCache = () => {
  specialtiesCache = null;
  cacheTimestamp = null;

  logger.debug(
    'medical_specialties_cache_cleared',
    'Medical specialties cache cleared',
    {
      component: 'medicalSpecialties',
    }
  );
};

/**
 * Add a new specialty to the cache immediately
 * This makes it available for other forms without waiting for API refresh
 */
export const addSpecialtyToCache = specialty => {
  // Add to localStorage for persistence
  try {
    let customSpecialties = [];
    const stored = localStorage.getItem('customMedicalSpecialties');
    if (stored) {
      customSpecialties = JSON.parse(stored);
    }

    // Add if not already exists (case-insensitive)
    if (
      !customSpecialties.find(s => s.toLowerCase() === specialty.toLowerCase())
    ) {
      customSpecialties.push(specialty);
      localStorage.setItem(
        'customMedicalSpecialties',
        JSON.stringify(customSpecialties)
      );

      logger.info(
        'specialty_added_to_localStorage',
        'New specialty saved to localStorage',
        {
          component: 'medicalSpecialties',
          specialty: specialty,
          totalCustom: customSpecialties.length,
        }
      );
    }
  } catch (e) {
    logger.error(
      'specialty_localStorage_save_error',
      'Failed to save specialty to localStorage',
      {
        component: 'medicalSpecialties',
        specialty: specialty,
        error: e.message,
      }
    );
  }

  // Also update in-memory cache if it exists
  if (!specialtiesCache) return;

  // Check if specialty already exists (case-insensitive)
  const exists = specialtiesCache.some(
    s => s.value.toLowerCase() === specialty.toLowerCase()
  );

  if (!exists) {
    const newSpecialty = {
      value: specialty,
      label: specialty,
      isCustom: true,
    };

    // Add to cache and resort
    const updatedCache = [
      ...specialtiesCache.filter(s => s.value !== 'Other'),
      newSpecialty,
    ].sort((a, b) => a.value.localeCompare(b.value));

    // Re-add "Other" option at the end
    updatedCache.push({
      value: 'Other',
      label: 'Other - Specify in notes',
      isOther: true,
    });

    specialtiesCache = updatedCache;

    logger.info('specialty_added_to_cache', 'New specialty added to cache', {
      component: 'medicalSpecialties',
      specialty: specialty,
      totalSpecialties: specialtiesCache.length,
    });
  }
};

/**
 * Get a specialty label by its value
 */
export const getSpecialtyLabel = value => {
  const specialty = DEFAULT_MEDICAL_SPECIALTIES.find(s => s.value === value);
  return specialty ? specialty.label : value;
};

/**
 * Check if a specialty value exists in the default list
 */
export const isDefaultSpecialty = value => {
  return DEFAULT_MEDICAL_SPECIALTIES.some(s => s.value === value);
};

/**
 * Initialize localStorage with known custom specialties from the database
 * This is a one-time setup function to migrate existing data
 */
export const initializeCustomSpecialties = () => {
  const knownCustomSpecialties = [];

  try {
    let customSpecialties = [];
    const stored = localStorage.getItem('customMedicalSpecialties');
    if (stored) {
      customSpecialties = JSON.parse(stored);
    }

    // Add known custom specialties if not already present
    let updated = false;
    knownCustomSpecialties.forEach(specialty => {
      if (
        !customSpecialties.find(
          s => s.toLowerCase() === specialty.toLowerCase()
        )
      ) {
        customSpecialties.push(specialty);
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem(
        'customMedicalSpecialties',
        JSON.stringify(customSpecialties)
      );
      logger.info(
        'custom_specialties_initialized',
        'Initialized custom specialties in localStorage',
        {
          component: 'medicalSpecialties',
          specialties: customSpecialties,
        }
      );
    }
  } catch (e) {
    logger.error(
      'custom_specialties_init_error',
      'Failed to initialize custom specialties',
      {
        component: 'medicalSpecialties',
        error: e.message,
      }
    );
  }
};
