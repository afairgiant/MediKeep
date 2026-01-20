/**
 * Comprehensive Lab Test Library
 * Contains standardized test names, units, categories, and metadata
 * Used for autocomplete and auto-fill functionality
 */

export interface TestLibraryItem {
  test_name: string;
  abbreviation?: string;
  test_code?: string; // LOINC or lab-specific code
  default_unit: string;
  category: 'chemistry' | 'hematology' | 'lipids' | 'endocrinology' | 'immunology' | 'microbiology' | 'toxicology' | 'genetics' | 'molecular' | 'pathology' | 'other';
  common_names?: string[]; // Alternative names for fuzzy matching
  is_common: boolean; // Prioritize in suggestions
  display_order?: number;
}

export const TEST_LIBRARY: TestLibraryItem[] = [
  // HEMATOLOGY - Complete Blood Count (CBC)
  {
    test_name: "White Blood Cell Count",
    abbreviation: "WBC",
    test_code: "6690-2",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["WBC", "White Blood Cells", "Leukocytes"],
    is_common: true,
    display_order: 1
  },
  {
    test_name: "Red Blood Cell Count",
    abbreviation: "RBC",
    test_code: "789-8",
    default_unit: "M/uL",
    category: "hematology",
    common_names: ["RBC", "Red Blood Cells", "Erythrocytes"],
    is_common: true,
    display_order: 2
  },
  {
    test_name: "Hemoglobin",
    abbreviation: "HGB",
    test_code: "718-7",
    default_unit: "g/dL",
    category: "hematology",
    common_names: ["HGB", "Hb", "Hemoglobin"],
    is_common: true,
    display_order: 3
  },
  {
    test_name: "Hematocrit",
    abbreviation: "HCT",
    test_code: "4544-3",
    default_unit: "%",
    category: "hematology",
    common_names: ["HCT", "Hct", "Packed Cell Volume"],
    is_common: true,
    display_order: 4
  },
  {
    test_name: "Platelet Count",
    abbreviation: "PLT",
    test_code: "777-3",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["PLT", "Platelets", "Thrombocytes"],
    is_common: true,
    display_order: 5
  },
  {
    test_name: "Mean Corpuscular Volume",
    abbreviation: "MCV",
    test_code: "787-2",
    default_unit: "fL",
    category: "hematology",
    common_names: ["MCV"],
    is_common: true,
    display_order: 6
  },
  {
    test_name: "Mean Corpuscular Hemoglobin",
    abbreviation: "MCH",
    test_code: "785-6",
    default_unit: "pg",
    category: "hematology",
    common_names: ["MCH"],
    is_common: true,
    display_order: 7
  },
  {
    test_name: "Mean Corpuscular Hemoglobin Concentration",
    abbreviation: "MCHC",
    test_code: "786-4",
    default_unit: "g/dL",
    category: "hematology",
    common_names: ["MCHC"],
    is_common: true,
    display_order: 8
  },
  {
    test_name: "Red Cell Distribution Width",
    abbreviation: "RDW",
    test_code: "788-0",
    default_unit: "%",
    category: "hematology",
    common_names: ["RDW", "RDW-CV"],
    is_common: true,
    display_order: 9
  },

  // HEMATOLOGY - Differential
  {
    test_name: "Neutrophils",
    abbreviation: "NEUT",
    default_unit: "%",
    category: "hematology",
    common_names: ["Neutrophils", "Segs", "Polys"],
    is_common: true,
    display_order: 10
  },
  {
    test_name: "Neutrophils (Absolute)",
    abbreviation: "NEUT#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Absolute Neutrophils", "ANC"],
    is_common: true,
    display_order: 11
  },
  {
    test_name: "Lymphocytes",
    abbreviation: "LYMPH",
    default_unit: "%",
    category: "hematology",
    common_names: ["Lymphs", "Lymphocytes"],
    is_common: true,
    display_order: 12
  },
  {
    test_name: "Lymphocytes (Absolute)",
    abbreviation: "LYMPH#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Absolute Lymphocytes", "ALC", "Lymphs (Absolute)", "Lymphs(Absolute)"],
    is_common: true,
    display_order: 13
  },
  {
    test_name: "Monocytes",
    abbreviation: "MONO",
    default_unit: "%",
    category: "hematology",
    common_names: ["Monocytes", "Monos"],
    is_common: true,
    display_order: 14
  },
  {
    test_name: "Monocytes (Absolute)",
    abbreviation: "MONO#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Absolute Monocytes", "AMC", "Monocytes(Absolute)"],
    is_common: true,
    display_order: 15
  },
  {
    test_name: "Eosinophils",
    abbreviation: "EOS",
    default_unit: "%",
    category: "hematology",
    common_names: ["Eosinophils", "Eos"],
    is_common: true,
    display_order: 16
  },
  {
    test_name: "Eosinophils (Absolute)",
    abbreviation: "EOS#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Absolute Eosinophils", "AEC", "Eos (Absolute)", "Eos(Absolute)"],
    is_common: true,
    display_order: 17
  },
  {
    test_name: "Basophils",
    abbreviation: "BASO",
    default_unit: "%",
    category: "hematology",
    common_names: ["Basophils", "Basos"],
    is_common: true,
    display_order: 18
  },
  {
    test_name: "Basophils (Absolute)",
    abbreviation: "BASO#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Absolute Basophils", "ABC", "Baso (Absolute)", "Baso(Absolute)"],
    is_common: true,
    display_order: 19
  },
  {
    test_name: "Immature Granulocytes",
    abbreviation: "IG",
    default_unit: "%",
    category: "hematology",
    common_names: ["Immature Grans", "IG"],
    is_common: false,
    display_order: 20
  },
  {
    test_name: "Immature Granulocytes (Absolute)",
    abbreviation: "IG#",
    default_unit: "K/uL",
    category: "hematology",
    common_names: ["Immature Grans Abs", "Absolute IG"],
    is_common: false,
    display_order: 21
  },

  // CHEMISTRY - Basic Metabolic Panel (BMP)
  {
    test_name: "Glucose",
    abbreviation: "GLU",
    test_code: "2345-7",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Blood Glucose", "Blood Sugar", "Glu"],
    is_common: true,
    display_order: 22
  },
  {
    test_name: "Sodium",
    abbreviation: "Na",
    test_code: "2951-2",
    default_unit: "mmol/L",
    category: "chemistry",
    common_names: ["Na", "Sodium"],
    is_common: true,
    display_order: 23
  },
  {
    test_name: "Potassium",
    abbreviation: "K",
    test_code: "2823-3",
    default_unit: "mmol/L",
    category: "chemistry",
    common_names: ["K", "Potassium"],
    is_common: true,
    display_order: 24
  },
  {
    test_name: "Chloride",
    abbreviation: "Cl",
    test_code: "2075-0",
    default_unit: "mmol/L",
    category: "chemistry",
    common_names: ["Cl", "Chloride"],
    is_common: true,
    display_order: 25
  },
  {
    test_name: "Carbon Dioxide",
    abbreviation: "CO2",
    test_code: "2028-9",
    default_unit: "mmol/L",
    category: "chemistry",
    common_names: ["CO2", "Bicarbonate", "HCO3"],
    is_common: true,
    display_order: 26
  },
  {
    test_name: "Blood Urea Nitrogen",
    abbreviation: "BUN",
    test_code: "3094-0",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["BUN", "Urea Nitrogen"],
    is_common: true,
    display_order: 27
  },
  {
    test_name: "Urea",
    abbreviation: "UREA",
    test_code: "3091-6",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Urea", "Serum Urea", "Blood Urea"],
    is_common: true,
    display_order: 28
  },
  {
    test_name: "Creatinine",
    abbreviation: "CREA",
    test_code: "2160-0",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Creatinine", "Cr", "Crea"],
    is_common: true,
    display_order: 29
  },
  {
    test_name: "Estimated GFR",
    abbreviation: "eGFR",
    default_unit: "mL/min/1.73m²",
    category: "chemistry",
    common_names: ["eGFR", "GFR"],
    is_common: true,
    display_order: 30
  },
  {
    test_name: "Calcium",
    abbreviation: "Ca",
    test_code: "17861-6",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Ca", "Calcium"],
    is_common: true,
    display_order: 31
  },

  // CHEMISTRY - Liver Function
  {
    test_name: "Total Protein",
    abbreviation: "TP",
    test_code: "2885-2",
    default_unit: "g/dL",
    category: "chemistry",
    common_names: ["Total Protein", "TP"],
    is_common: true,
    display_order: 32
  },
  {
    test_name: "Albumin",
    abbreviation: "ALB",
    test_code: "1751-7",
    default_unit: "g/dL",
    category: "chemistry",
    common_names: ["Albumin", "Alb"],
    is_common: true,
    display_order: 33
  },
  {
    test_name: "Total Bilirubin",
    abbreviation: "TBIL",
    test_code: "1975-2",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Total Bilirubin", "T Bili"],
    is_common: true,
    display_order: 34
  },
  {
    test_name: "Direct Bilirubin",
    abbreviation: "DBIL",
    test_code: "1968-7",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Direct Bilirubin", "D Bili", "Conjugated Bilirubin"],
    is_common: false,
    display_order: 35
  },
  {
    test_name: "Alkaline Phosphatase",
    abbreviation: "ALP",
    test_code: "6768-6",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["ALP", "Alk Phos", "Alkaline Phosphatase"],
    is_common: true,
    display_order: 36
  },
  {
    test_name: "Alanine Aminotransferase",
    abbreviation: "ALT",
    test_code: "1742-6",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["ALT", "SGPT", "Alanine Transaminase"],
    is_common: true,
    display_order: 37
  },
  {
    test_name: "Aspartate Aminotransferase",
    abbreviation: "AST",
    test_code: "1920-8",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["AST", "SGOT", "Aspartate Transaminase"],
    is_common: true,
    display_order: 38
  },
  {
    test_name: "Gamma-glutamyl Transferase",
    abbreviation: "GGT",
    test_code: "2324-2",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["GGT", "Gamma GT", "GGTP", "Gamma-glutamyl Transpeptidase"],
    is_common: true,
    display_order: 39
  },

  // LIPIDS - Lipid Panel
  {
    test_name: "Total Cholesterol",
    abbreviation: "CHOL",
    test_code: "2093-3",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["Cholesterol", "Total Chol", "CHOLESTEROL, TOTAL", "Cholesterol Total"],
    is_common: true,
    display_order: 40
  },
  {
    test_name: "LDL Cholesterol",
    abbreviation: "LDL",
    test_code: "18262-6",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["LDL", "LDL-C", "Bad Cholesterol", "LDL-CHOLESTEROL", "LDL Calculated"],
    is_common: true,
    display_order: 41
  },
  {
    test_name: "HDL Cholesterol",
    abbreviation: "HDL",
    test_code: "2085-9",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["HDL", "HDL-C", "Good Cholesterol", "HDL CHOLESTEROL"],
    is_common: true,
    display_order: 42
  },
  {
    test_name: "Triglycerides",
    abbreviation: "TRIG",
    test_code: "2571-8",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["Triglycerides", "TG", "Trig", "TRIGLYCERIDES"],
    is_common: true,
    display_order: 43
  },
  {
    test_name: "VLDL Cholesterol",
    abbreviation: "VLDL",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["VLDL", "VLDL-C"],
    is_common: false,
    display_order: 44
  },
  {
    test_name: "Non-HDL Cholesterol",
    abbreviation: "Non-HDL",
    default_unit: "mg/dL",
    category: "lipids",
    common_names: ["Non-HDL", "Non-HDL-C", "NON HDL CHOLESTEROL", "Non HDL-C"],
    is_common: false,
    display_order: 45
  },

  // ENDOCRINOLOGY - Thyroid
  {
    test_name: "Thyroid Stimulating Hormone",
    abbreviation: "TSH",
    test_code: "3016-3",
    default_unit: "mIU/L",
    category: "endocrinology",
    common_names: ["TSH", "Thyrotropin"],
    is_common: true,
    display_order: 46
  },
  {
    test_name: "Free T4",
    abbreviation: "FT4",
    test_code: "3024-7",
    default_unit: "ng/dL",
    category: "endocrinology",
    common_names: ["Free T4", "FT4", "Free Thyroxine"],
    is_common: true,
    display_order: 47
  },
  {
    test_name: "Free T3",
    abbreviation: "FT3",
    test_code: "3051-0",
    default_unit: "pg/mL",
    category: "endocrinology",
    common_names: ["Free T3", "FT3", "Free Triiodothyronine"],
    is_common: false,
    display_order: 48
  },
  {
    test_name: "Total T4",
    abbreviation: "T4",
    test_code: "3053-6",
    default_unit: "μg/dL",
    category: "endocrinology",
    common_names: ["Total T4", "T4", "Thyroxine"],
    is_common: false,
    display_order: 49
  },
  {
    test_name: "Total T3",
    abbreviation: "T3",
    test_code: "3053-6",
    default_unit: "ng/dL",
    category: "endocrinology",
    common_names: ["Total T3", "T3", "Triiodothyronine"],
    is_common: false,
    display_order: 50
  },

  // ENDOCRINOLOGY - Diabetes
  {
    test_name: "Hemoglobin A1c",
    abbreviation: "HbA1c",
    test_code: "4548-4",
    default_unit: "%",
    category: "chemistry",
    common_names: ["HbA1c", "A1c", "Glycated Hemoglobin"],
    is_common: true,
    display_order: 51
  },
  {
    test_name: "Estimated Average Glucose",
    abbreviation: "eAG",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["eAG", "Average Glucose"],
    is_common: false,
    display_order: 52
  },

  // CHEMISTRY - Additional Common Tests
  {
    test_name: "Magnesium",
    abbreviation: "Mg",
    test_code: "2601-3",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Mg", "Magnesium"],
    is_common: false,
    display_order: 53
  },
  {
    test_name: "Phosphorus",
    abbreviation: "PHOS",
    test_code: "2777-1",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Phosphorus", "Phos", "Phosphate"],
    is_common: false,
    display_order: 54
  },
  {
    test_name: "Uric Acid",
    abbreviation: "UA",
    test_code: "3084-1",
    default_unit: "mg/dL",
    category: "chemistry",
    common_names: ["Uric Acid", "UA"],
    is_common: false,
    display_order: 55
  },
  {
    test_name: "Lactate Dehydrogenase",
    abbreviation: "LDH",
    test_code: "2532-0",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["LDH", "Lactate Dehydrogenase"],
    is_common: false,
    display_order: 56
  },
  {
    test_name: "Creatine Kinase",
    abbreviation: "CK",
    test_code: "2157-6",
    default_unit: "U/L",
    category: "chemistry",
    common_names: ["CK", "CPK", "Creatine Kinase"],
    is_common: false,
    display_order: 57
  },

  // HEMATOLOGY - Coagulation
  {
    test_name: "Prothrombin Time",
    abbreviation: "PT",
    test_code: "5902-2",
    default_unit: "seconds",
    category: "hematology",
    common_names: ["PT", "Prothrombin Time", "ProTime"],
    is_common: false,
    display_order: 58
  },
  {
    test_name: "INR",
    abbreviation: "INR",
    test_code: "6301-6",
    default_unit: "ratio",
    category: "hematology",
    common_names: ["INR", "International Normalized Ratio"],
    is_common: false,
    display_order: 59
  },
  {
    test_name: "Partial Thromboplastin Time",
    abbreviation: "PTT",
    test_code: "5894-1",
    default_unit: "seconds",
    category: "hematology",
    common_names: ["PTT", "aPTT", "Activated PTT"],
    is_common: false,
    display_order: 60
  },

  // IMMUNOLOGY
  {
    test_name: "C-Reactive Protein",
    abbreviation: "CRP",
    test_code: "1988-5",
    default_unit: "mg/L",
    category: "immunology",
    common_names: ["CRP", "C-Reactive Protein"],
    is_common: false,
    display_order: 61
  },
  {
    test_name: "Erythrocyte Sedimentation Rate",
    abbreviation: "ESR",
    test_code: "4537-7",
    default_unit: "mm/hr",
    category: "immunology",
    common_names: ["ESR", "Sed Rate"],
    is_common: false,
    display_order: 62
  },

  // ENDOCRINOLOGY - Additional
  {
    test_name: "Testosterone",
    abbreviation: "TEST",
    default_unit: "ng/dL",
    category: "endocrinology",
    common_names: ["Testosterone", "Total Testosterone"],
    is_common: false,
    display_order: 63
  },
  {
    test_name: "Cortisol",
    abbreviation: "CORT",
    default_unit: "μg/dL",
    category: "endocrinology",
    common_names: ["Cortisol"],
    is_common: false,
    display_order: 64
  },
  {
    test_name: "Vitamin D",
    abbreviation: "VitD",
    test_code: "1989-3",
    default_unit: "ng/mL",
    category: "chemistry",
    common_names: ["Vitamin D", "25-OH Vitamin D", "Vitamin D 25-Hydroxy"],
    is_common: false,
    display_order: 65
  },
  {
    test_name: "Vitamin B12",
    abbreviation: "B12",
    test_code: "2132-9",
    default_unit: "pg/mL",
    category: "chemistry",
    common_names: ["Vitamin B12", "B12", "Cobalamin"],
    is_common: false,
    display_order: 66
  },
  {
    test_name: "Folate",
    abbreviation: "FOLATE",
    test_code: "2284-8",
    default_unit: "ng/mL",
    category: "chemistry",
    common_names: ["Folate", "Folic Acid"],
    is_common: false,
    display_order: 67
  },
  {
    test_name: "Iron",
    abbreviation: "Fe",
    test_code: "2498-4",
    default_unit: "μg/dL",
    category: "chemistry",
    common_names: ["Iron", "Fe", "Serum Iron"],
    is_common: false,
    display_order: 68
  },
  {
    test_name: "Ferritin",
    abbreviation: "FERR",
    test_code: "2276-4",
    default_unit: "ng/mL",
    category: "chemistry",
    common_names: ["Ferritin"],
    is_common: false,
    display_order: 69
  },
  {
    test_name: "Total Iron Binding Capacity",
    abbreviation: "TIBC",
    test_code: "2500-7",
    default_unit: "μg/dL",
    category: "chemistry",
    common_names: ["TIBC", "Iron Binding Capacity"],
    is_common: false,
    display_order: 70
  },
  {
    test_name: "Transferrin Saturation",
    abbreviation: "TSAT",
    test_code: "2502-3",
    default_unit: "%",
    category: "chemistry",
    common_names: ["Transferrin Saturation", "TSAT"],
    is_common: false,
    display_order: 71
  },

  // CHEMISTRY - Calculated Values
  {
    test_name: "BUN/Creatinine Ratio",
    abbreviation: "BUN/CREA",
    default_unit: "ratio",
    category: "chemistry",
    common_names: ["BUN/Creatinine Ratio", "BUN/Cr"],
    is_common: false,
    display_order: 72
  },
  {
    test_name: "Globulin Total",
    abbreviation: "GLOB",
    default_unit: "g/dL",
    category: "chemistry",
    common_names: ["Globulin", "Total Globulin"],
    is_common: false,
    display_order: 73
  },
  {
    test_name: "LDL/HDL Ratio",
    abbreviation: "LDL/HDL",
    default_unit: "ratio",
    category: "lipids",
    common_names: ["LDL/HDL Ratio", "Cholesterol Ratio", "CHOL/HDLC RATIO", "Total Cholesterol/HDL Ratio"],
    is_common: false,
    display_order: 74
  },

  // ENDOCRINOLOGY - Reproductive Hormones
  {
    test_name: "Luteinizing Hormone",
    abbreviation: "LH",
    default_unit: "mIU/mL",
    category: "endocrinology",
    common_names: ["LH", "Luteinizing Hormone"],
    is_common: false,
    display_order: 75
  },
  {
    test_name: "Follicle Stimulating Hormone",
    abbreviation: "FSH",
    default_unit: "mIU/mL",
    category: "endocrinology",
    common_names: ["FSH", "Follicle Stimulating Hormone"],
    is_common: false,
    display_order: 76
  },
  {
    test_name: "Free Testosterone (Direct)",
    abbreviation: "Free TEST",
    default_unit: "pg/mL",
    category: "endocrinology",
    common_names: ["Free Testosterone", "Free Test"],
    is_common: false,
    display_order: 77
  },
  {
    test_name: "Estradiol (Sensitive)",
    abbreviation: "E2",
    default_unit: "pg/mL",
    category: "endocrinology",
    common_names: ["Estradiol", "E2", "Estradiol Sensitive"],
    is_common: false,
    display_order: 78
  },
  {
    test_name: "Vitamin D, 25-Hydroxy",
    abbreviation: "Vit D",
    test_code: "1989-3",
    default_unit: "ng/mL",
    category: "chemistry",
    common_names: ["Vitamin D", "25-OH Vitamin D", "Vitamin D 25-Hydroxy", "25-Hydroxyvitamin D"],
    is_common: true,
    display_order: 79
  },
];

/**
 * Helper Functions
 */

// Pre-sorted test library for performance (avoid repeated sorting)
const SORTED_TEST_LIBRARY = [...TEST_LIBRARY].sort((a, b) =>
  a.test_name.localeCompare(b.test_name)
);

/**
 * Search tests by name, abbreviation, or common names
 * Supports fuzzy matching for better UX
 */
export function searchTests(query: string, limit: number = 200): TestLibraryItem[] {
  if (!query || query.trim().length === 0) {
    // Return pre-sorted tests (performance optimization)
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
      // First sort by score (descending)
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      // Then sort alphabetically by test name
      return a.test.test_name.localeCompare(b.test.test_name);
    })
    .slice(0, limit)
    .map(result => result.test);
}

/**
 * Get tests by category
 */
export function getTestsByCategory(category: TestLibraryItem['category']): TestLibraryItem[] {
  return TEST_LIBRARY
    .filter(test => test.category === category)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
}

/**
 * Get only common tests (for default suggestions)
 */
export function getCommonTests(): TestLibraryItem[] {
  return TEST_LIBRARY
    .filter(test => test.is_common)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
}

/**
 * Get test by exact name match
 */
export function getTestByName(testName: string): TestLibraryItem | undefined {
  return TEST_LIBRARY.find(
    test => test.test_name.toLowerCase() === testName.toLowerCase() ||
            test.abbreviation?.toLowerCase() === testName.toLowerCase()
  );
}

/**
 * Get autocomplete options formatted for Mantine Autocomplete
 */
export function getAutocompleteOptions(query: string = '', limit: number = 200): string[] {
  const tests = searchTests(query, limit);
  return tests.map(test => {
    if (test.abbreviation) {
      return `${test.test_name} (${test.abbreviation})`;
    }
    return test.test_name;
  });
}

/**
 * Extract test name from autocomplete selection
 * Handles format: "Test Name (ABBR)" -> "Test Name"
 */
export function extractTestName(selection: string): string {
  const match = selection.match(/^(.+?)\s*(?:\([^)]+\))?$/);
  return match ? match[1].trim() : selection;
}
