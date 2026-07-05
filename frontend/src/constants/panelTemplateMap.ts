import { ComponentRowData, createEmptyRow } from '../utils/labTestComponentUtils';
import { getTestByName } from './testLibrary';

export interface TestTemplate {
  id: string;
  category: string;
  tests: Array<{
    test_name: string;
    abbreviation?: string;
    test_code?: string;
    unit: string;
    default_display_order?: number;
    notes?: string;
    result_type?: 'quantitative' | 'qualitative' | 'textual';
  }>;
}

export const PANEL_TEMPLATES: TestTemplate[] = [
  {
    id: 'basic_metabolic_panel',
    category: 'chemistry',
    tests: [
      { test_name: 'Glucose', abbreviation: 'GLUC', test_code: '2345-7', unit: 'mg/dL', default_display_order: 1 },
      { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
      { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
      { test_name: 'Sodium', abbreviation: 'Na', test_code: '2951-2', unit: 'mEq/L', default_display_order: 4 },
      { test_name: 'Potassium', abbreviation: 'K', test_code: '2823-3', unit: 'mEq/L', default_display_order: 5 },
      { test_name: 'Chloride', abbreviation: 'Cl', test_code: '2075-0', unit: 'mEq/L', default_display_order: 6 },
      { test_name: 'Carbon Dioxide', abbreviation: 'CO2', test_code: '2028-9', unit: 'mEq/L', default_display_order: 7 },
    ],
  },
  {
    id: 'comprehensive_metabolic_panel',
    category: 'chemistry',
    tests: [
      { test_name: 'Glucose', abbreviation: 'GLUC', test_code: '2345-7', unit: 'mg/dL', default_display_order: 1 },
      { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
      { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
      { test_name: 'Sodium', abbreviation: 'Na', test_code: '2951-2', unit: 'mEq/L', default_display_order: 4 },
      { test_name: 'Potassium', abbreviation: 'K', test_code: '2823-3', unit: 'mEq/L', default_display_order: 5 },
      { test_name: 'Chloride', abbreviation: 'Cl', test_code: '2075-0', unit: 'mEq/L', default_display_order: 6 },
      { test_name: 'Carbon Dioxide', abbreviation: 'CO2', test_code: '2028-9', unit: 'mEq/L', default_display_order: 7 },
      { test_name: 'Total Protein', abbreviation: 'TP', test_code: '2885-2', unit: 'g/dL', default_display_order: 8 },
      { test_name: 'Albumin', abbreviation: 'ALB', test_code: '1751-7', unit: 'g/dL', default_display_order: 9 },
      { test_name: 'Total Bilirubin', abbreviation: 'TBIL', test_code: '1975-2', unit: 'mg/dL', default_display_order: 10 },
      { test_name: 'Alkaline Phosphatase', abbreviation: 'ALP', test_code: '6768-6', unit: 'U/L', default_display_order: 11 },
      { test_name: 'Alanine Aminotransferase', abbreviation: 'ALT', test_code: '1742-6', unit: 'U/L', default_display_order: 12 },
      { test_name: 'Aspartate Aminotransferase', abbreviation: 'AST', test_code: '1920-8', unit: 'U/L', default_display_order: 13 },
    ],
  },
  {
    id: 'complete_blood_count',
    category: 'hematology',
    tests: [
      { test_name: 'White Blood Cell Count', abbreviation: 'WBC', test_code: '6690-2', unit: 'K/uL', default_display_order: 1 },
      { test_name: 'Red Blood Cell Count', abbreviation: 'RBC', test_code: '789-8', unit: 'M/uL', default_display_order: 2 },
      { test_name: 'Hemoglobin', abbreviation: 'HGB', test_code: '718-7', unit: 'g/dL', default_display_order: 3 },
      { test_name: 'Hematocrit', abbreviation: 'HCT', test_code: '4544-3', unit: '%', default_display_order: 4 },
      { test_name: 'Mean Corpuscular Volume', abbreviation: 'MCV', test_code: '787-2', unit: 'fL', default_display_order: 5 },
      { test_name: 'Mean Corpuscular Hemoglobin', abbreviation: 'MCH', test_code: '785-6', unit: 'pg', default_display_order: 6 },
      { test_name: 'Mean Corpuscular Hemoglobin Concentration', abbreviation: 'MCHC', test_code: '786-4', unit: 'g/dL', default_display_order: 7 },
      { test_name: 'Platelet Count', abbreviation: 'PLT', test_code: '777-3', unit: 'K/uL', default_display_order: 8 },
    ],
  },
  {
    id: 'lipid_panel',
    category: 'chemistry',
    tests: [
      { test_name: 'Total Cholesterol', abbreviation: 'CHOL', test_code: '2093-3', unit: 'mg/dL', default_display_order: 1 },
      { test_name: 'Triglycerides', abbreviation: 'TRIG', test_code: '2571-8', unit: 'mg/dL', default_display_order: 2 },
      { test_name: 'HDL Cholesterol', abbreviation: 'HDL', test_code: '2085-9', unit: 'mg/dL', default_display_order: 3 },
      { test_name: 'LDL Cholesterol', abbreviation: 'LDL', test_code: '18262-6', unit: 'mg/dL', default_display_order: 4 },
      { test_name: 'Non-HDL Cholesterol', abbreviation: 'Non-HDL', test_code: '43396-1', unit: 'mg/dL', default_display_order: 5 },
    ],
  },
  {
    id: 'thyroid_function',
    category: 'endocrinology',
    tests: [
      { test_name: 'Thyroid Stimulating Hormone', abbreviation: 'TSH', test_code: '3016-3', unit: 'mIU/L', default_display_order: 1 },
      { test_name: 'Free Thyroxine', abbreviation: 'FT4', test_code: '3024-7', unit: 'ng/dL', default_display_order: 2 },
      { test_name: 'Free Triiodothyronine', abbreviation: 'FT3', test_code: '3051-0', unit: 'pg/mL', default_display_order: 3 },
    ],
  },
  {
    id: 'liver_function',
    category: 'hepatology',
    tests: [
      { test_name: 'Alanine Aminotransferase', abbreviation: 'ALT', test_code: '1742-6', unit: 'U/L', default_display_order: 1 },
      { test_name: 'Aspartate Aminotransferase', abbreviation: 'AST', test_code: '1920-8', unit: 'U/L', default_display_order: 2 },
      { test_name: 'Alkaline Phosphatase', abbreviation: 'ALP', test_code: '6768-6', unit: 'U/L', default_display_order: 3 },
      { test_name: 'Gamma-glutamyl Transferase', abbreviation: 'GGT', test_code: '2324-2', unit: 'U/L', default_display_order: 4 },
      { test_name: 'Total Bilirubin', abbreviation: 'TBIL', test_code: '1975-2', unit: 'mg/dL', default_display_order: 5 },
      { test_name: 'Direct Bilirubin', abbreviation: 'DBIL', test_code: '1968-7', unit: 'mg/dL', default_display_order: 6 },
      { test_name: 'Albumin', abbreviation: 'ALB', test_code: '1751-7', unit: 'g/dL', default_display_order: 7 },
      { test_name: 'Total Protein', abbreviation: 'TP', test_code: '2885-2', unit: 'g/dL', default_display_order: 8 },
      { test_name: 'Somatomedin C', abbreviation: 'IGF-1', test_code: '2484-4', unit: 'ng/mL', default_display_order: 9 },
      { test_name: 'Transferrin', abbreviation: 'TRF', test_code: '3034-6', unit: 'mg/dL', default_display_order: 10 },
    ],
  },
  {
    id: 'kidney_function',
    category: 'chemistry',
    tests: [
      { test_name: 'Urea', abbreviation: 'UREA', test_code: '3091-6', unit: 'mg/dL', default_display_order: 1 },
      { test_name: 'Blood Urea Nitrogen', abbreviation: 'BUN', test_code: '6299-2', unit: 'mg/dL', default_display_order: 2 },
      { test_name: 'Creatinine', abbreviation: 'CREAT', test_code: '2160-0', unit: 'mg/dL', default_display_order: 3 },
      { test_name: 'Estimated GFR', abbreviation: 'eGFR', unit: 'mL/min/1.73m²', default_display_order: 4 },
    ],
  },
  {
    id: 'infectious_disease_panel',
    category: 'immunology',
    tests: [
      { test_name: 'HIV 1 Antibody', abbreviation: 'Anti-HIV 1', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'HIV 2 Antibody', abbreviation: 'Anti-HIV 2', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'Hepatitis B Surface Antibody', abbreviation: 'Anti-HBs', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'Hepatitis C Antibody', abbreviation: 'Anti-HCV', unit: '', default_display_order: 4, result_type: 'qualitative' },
      { test_name: 'VDRL', abbreviation: 'VDRL', unit: '', default_display_order: 5, result_type: 'qualitative' },
      { test_name: 'SARS-CoV-2', abbreviation: 'SARS-CoV-2', unit: '', default_display_order: 6, result_type: 'qualitative' },
      { test_name: 'Mycoplasma hominis', unit: '', default_display_order: 7, result_type: 'qualitative' },
      { test_name: 'Ureaplasma spp', unit: '', default_display_order: 8, result_type: 'qualitative' },
    ],
  },
  {
    id: 'autoimmune_panel',
    category: 'immunology',
    tests: [
      { test_name: 'ANA', abbreviation: 'ANA', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'Anti-dsDNA', abbreviation: 'Anti-dsDNA', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'Anti-Sm', abbreviation: 'Anti-Sm', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'Anti-RNP', abbreviation: 'Anti-RNP', unit: '', default_display_order: 4, result_type: 'qualitative' },
      { test_name: 'Anti-SSA', abbreviation: 'Anti-SSA', unit: '', default_display_order: 5, result_type: 'qualitative' },
      { test_name: 'Anti-SSB', abbreviation: 'Anti-SSB', unit: '', default_display_order: 6, result_type: 'qualitative' },
      { test_name: 'Anti-Jo-1', abbreviation: 'Anti-Jo-1', unit: '', default_display_order: 7, result_type: 'qualitative' },
      { test_name: 'Anti-SLA/LP', abbreviation: 'Anti-SLA/LP', unit: '', default_display_order: 8, result_type: 'qualitative' },
    ],
  },
  {
    id: 'viral_serology_panel',
    category: 'immunology',
    tests: [
      { test_name: 'EBV VCA IgM', abbreviation: 'EBV IgM', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'EBV VCA IgG', abbreviation: 'EBV IgG', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'CMV IgM', abbreviation: 'CMV IgM', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'CMV IgG', abbreviation: 'CMV IgG', unit: '', default_display_order: 4, result_type: 'qualitative' },
      { test_name: 'HSV-1 IgM', unit: '', default_display_order: 5, result_type: 'qualitative' },
      { test_name: 'HSV-1 IgG', unit: '', default_display_order: 6, result_type: 'qualitative' },
      { test_name: 'HSV-2 IgM', unit: '', default_display_order: 7, result_type: 'qualitative' },
      { test_name: 'HSV-2 IgG', unit: '', default_display_order: 8, result_type: 'qualitative' },
    ],
  },
  {
    id: 'psa_panel',
    category: 'other',
    tests: [
      { test_name: 'Prostate Specific Antigen', abbreviation: 'PSA', test_code: '2857-1', unit: 'ng/mL', default_display_order: 1 },
    ],
  },
  {
    id: 'mri',
    category: 'imaging',
    tests: [
      { test_name: 'MRI', abbreviation: 'MRI', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'ct_scan',
    category: 'imaging',
    tests: [
      { test_name: 'CT Scan', abbreviation: 'CT', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'x_ray',
    category: 'imaging',
    tests: [
      { test_name: 'X-Ray', abbreviation: 'XR', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'ultrasound',
    category: 'imaging',
    tests: [
      { test_name: 'Ultrasound', abbreviation: 'US', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'adrenal_function',
    category: 'endocrinology',
    tests: [
      { test_name: 'ACTH', abbreviation: 'ACTH', test_code: '2141-0', unit: 'pg/mL', default_display_order: 1 },
      { test_name: 'Cortisol', abbreviation: 'CORT', test_code: '2143-6', unit: 'µg/dL', default_display_order: 2 },
      { test_name: 'DHEA-S', abbreviation: 'DHEA-S', test_code: '2191-5', unit: 'µg/dL', default_display_order: 3 },
      { test_name: 'Aldosterone', abbreviation: 'ALD', test_code: '1763-2', unit: 'ng/dL', default_display_order: 4 },
    ],
  },
  {
    id: 'allergy_testing',
    category: 'immunology',
    tests: [
      { test_name: 'Total IgE', abbreviation: 'IgE', test_code: '13834-7', unit: 'kU/L', default_display_order: 1 },
      { test_name: 'Eosinophil Count', abbreviation: 'EOS', test_code: '26449-9', unit: 'K/uL', default_display_order: 2 },
    ],
  },
  {
    id: 'b12_folate',
    category: 'hematology',
    tests: [
      { test_name: 'Vitamin B12', abbreviation: 'B12', test_code: '2132-9', unit: 'pg/mL', default_display_order: 1 },
      { test_name: 'Folate', abbreviation: 'FOL', test_code: '2284-8', unit: 'ng/mL', default_display_order: 2 },
    ],
  },
  {
    id: 'bnp_panel',
    category: 'cardiology',
    tests: [
      { test_name: 'BNP', abbreviation: 'BNP', test_code: '42637-9', unit: 'pg/mL', default_display_order: 1 },
      { test_name: 'NT-proBNP', abbreviation: 'NT-proBNP', test_code: '33762-6', unit: 'pg/mL', default_display_order: 2 },
    ],
  },
  {
    id: 'blood_culture',
    category: 'microbiology',
    tests: [
      { test_name: 'Blood Culture', abbreviation: 'BC', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'cardiac_enzymes',
    category: 'cardiology',
    tests: [
      { test_name: 'Troponin I', abbreviation: 'TnI', test_code: '10839-9', unit: 'ng/mL', default_display_order: 1 },
      { test_name: 'Troponin T', abbreviation: 'TnT', test_code: '6598-7', unit: 'ng/mL', default_display_order: 2 },
      { test_name: 'CK-MB', abbreviation: 'CK-MB', test_code: '13969-1', unit: 'ng/mL', default_display_order: 3 },
      { test_name: 'Creatine Kinase', abbreviation: 'CK', test_code: '2157-6', unit: 'U/L', default_display_order: 4 },
      { test_name: 'Myoglobin', abbreviation: 'MYO', test_code: '2639-3', unit: 'ng/mL', default_display_order: 5 },
    ],
  },
  {
    id: 'coagulation',
    category: 'hematology',
    tests: [
      { test_name: 'Prothrombin Time', abbreviation: 'PT', test_code: '5902-2', unit: 'seconds', default_display_order: 1 },
      { test_name: 'INR', abbreviation: 'INR', test_code: '6301-6', unit: '', default_display_order: 2 },
      { test_name: 'Activated Partial Thromboplastin Time', abbreviation: 'aPTT', test_code: '3173-2', unit: 'seconds', default_display_order: 3 },
      { test_name: 'Fibrinogen', abbreviation: 'FIB', test_code: '3255-7', unit: 'mg/dL', default_display_order: 4 },
    ],
  },
  {
    id: 'diabetes_monitoring',
    category: 'endocrinology',
    tests: [
      { test_name: 'Fasting Glucose', abbreviation: 'GLUC', test_code: '1558-6', unit: 'mg/dL', default_display_order: 1 },
      { test_name: 'Hemoglobin A1c', abbreviation: 'HbA1c', test_code: '4548-4', unit: '%', default_display_order: 2 },
      { test_name: 'Fasting Insulin', abbreviation: 'INS', test_code: '20448-7', unit: 'µIU/mL', default_display_order: 3 },
    ],
  },
  {
    id: 'drug_levels',
    category: 'toxicology',
    tests: [
      { test_name: 'Drug Level', abbreviation: '', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'electrolytes',
    category: 'chemistry',
    tests: [
      { test_name: 'Sodium', abbreviation: 'Na', test_code: '2951-2', unit: 'mEq/L', default_display_order: 1 },
      { test_name: 'Potassium', abbreviation: 'K', test_code: '2823-3', unit: 'mEq/L', default_display_order: 2 },
      { test_name: 'Chloride', abbreviation: 'Cl', test_code: '2075-0', unit: 'mEq/L', default_display_order: 3 },
      { test_name: 'Carbon Dioxide', abbreviation: 'CO2', test_code: '2028-9', unit: 'mEq/L', default_display_order: 4 },
      { test_name: 'Calcium', abbreviation: 'Ca', test_code: '17861-6', unit: 'mg/dL', default_display_order: 5 },
      { test_name: 'Magnesium', abbreviation: 'Mg', test_code: '2601-3', unit: 'mEq/L', default_display_order: 6 },
      { test_name: 'Phosphorus', abbreviation: 'PHOS', test_code: '2777-1', unit: 'mg/dL', default_display_order: 7 },
    ],
  },
  {
    id: 'glucose_tolerance',
    category: 'endocrinology',
    tests: [
      { test_name: 'Fasting Glucose', abbreviation: 'GLUC-0', test_code: '1558-6', unit: 'mg/dL', default_display_order: 1 },
      { test_name: '1-Hour Glucose', abbreviation: 'GLUC-1h', unit: 'mg/dL', default_display_order: 2 },
      { test_name: '2-Hour Glucose', abbreviation: 'GLUC-2h', unit: 'mg/dL', default_display_order: 3 },
    ],
  },
  {
    id: 'hiv_panel',
    category: 'immunology',
    tests: [
      { test_name: 'HIV-1/2 Antibody', abbreviation: 'Anti-HIV', test_code: '40732-0', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'HIV-1 RNA', abbreviation: 'HIV RNA', test_code: '20447-9', unit: 'copies/mL', default_display_order: 2 },
      { test_name: 'CD4 Count', abbreviation: 'CD4', test_code: '24467-3', unit: 'cells/µL', default_display_order: 3 },
    ],
  },
  {
    id: 'hepatitis_panel',
    category: 'immunology',
    tests: [
      { test_name: 'Hepatitis B Surface Antigen', abbreviation: 'HBsAg', test_code: '5196-1', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'Hepatitis B Surface Antibody', abbreviation: 'Anti-HBs', test_code: '16935-9', unit: 'IU/L', default_display_order: 2 },
      { test_name: 'Hepatitis B Core Antibody', abbreviation: 'Anti-HBc', test_code: '16933-4', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'Hepatitis C Antibody', abbreviation: 'Anti-HCV', test_code: '13955-0', unit: '', default_display_order: 4, result_type: 'qualitative' },
    ],
  },
  {
    id: 'inflammatory_markers',
    category: 'immunology',
    tests: [
      { test_name: 'Erythrocyte Sedimentation Rate', abbreviation: 'ESR', test_code: '4537-7', unit: 'mm/hr', default_display_order: 1 },
      { test_name: 'C-Reactive Protein', abbreviation: 'CRP', test_code: '1988-5', unit: 'mg/L', default_display_order: 2 },
      { test_name: 'Procalcitonin', abbreviation: 'PCT', test_code: '33959-8', unit: 'ng/mL', default_display_order: 3 },
    ],
  },
  {
    id: 'iron_studies',
    category: 'hematology',
    tests: [
      { test_name: 'Serum Iron', abbreviation: 'Fe', test_code: '2498-4', unit: 'µg/dL', default_display_order: 1 },
      { test_name: 'Unsaturated Iron Binding Capacity', abbreviation: 'UIBC', test_code: '2501-5', unit: 'µg/dL', default_display_order: 2 },
      { test_name: 'Transferrin Saturation', abbreviation: 'TSAT', test_code: '2502-3', unit: '%', default_display_order: 3 },
      { test_name: 'Ferritin', abbreviation: 'FERR', test_code: '2276-4', unit: 'ng/mL', default_display_order: 4 },
    ],
  },
  {
    id: 'prenatal',
    category: 'other',
    tests: [
      { test_name: 'Blood Type', abbreviation: 'ABO', test_code: '883-9', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'Rh Factor', abbreviation: 'Rh', test_code: '10331-7', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'Rubella IgG', abbreviation: 'Rubella IgG', test_code: '8014-3', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'Hemoglobin', abbreviation: 'HGB', test_code: '718-7', unit: 'g/dL', default_display_order: 4 },
      { test_name: 'Gestational Diabetes Screen', abbreviation: 'GDM', unit: 'mg/dL', default_display_order: 5 },
    ],
  },
  {
    id: 'respiratory_viral',
    category: 'microbiology',
    tests: [
      { test_name: 'Influenza A', abbreviation: 'Flu A', test_code: '43874-7', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'Influenza B', abbreviation: 'Flu B', test_code: '43895-2', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'RSV', abbreviation: 'RSV', test_code: '30075-6', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'SARS-CoV-2', abbreviation: 'COVID-19', test_code: '94500-6', unit: '', default_display_order: 4, result_type: 'qualitative' },
    ],
  },
  {
    id: 'reticulocyte',
    category: 'hematology',
    tests: [
      { test_name: 'Reticulocyte Count', abbreviation: 'RETIC', test_code: '17849-1', unit: '%', default_display_order: 1 },
      { test_name: 'Reticulocyte Absolute Count', abbreviation: 'RETIC#', test_code: '60474-4', unit: 'K/uL', default_display_order: 2 },
      { test_name: 'Immature Reticulocyte Fraction', abbreviation: 'IRF', unit: '%', default_display_order: 3 },
    ],
  },
  {
    id: 'sti_panel',
    category: 'microbiology',
    tests: [
      { test_name: 'Syphilis RPR', abbreviation: 'RPR', test_code: '20508-8', unit: '', default_display_order: 1, result_type: 'qualitative' },
      { test_name: 'Chlamydia', abbreviation: 'CT', test_code: '21613-5', unit: '', default_display_order: 2, result_type: 'qualitative' },
      { test_name: 'Gonorrhea', abbreviation: 'GC', test_code: '21415-5', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'HSV-2 IgG', abbreviation: 'HSV-2', test_code: '43180-9', unit: '', default_display_order: 4, result_type: 'qualitative' },
    ],
  },
  {
    id: 'sex_hormones',
    category: 'endocrinology',
    tests: [
      { test_name: 'Follicle Stimulating Hormone', abbreviation: 'FSH', test_code: '15067-2', unit: 'mIU/mL', default_display_order: 1 },
      { test_name: 'Luteinizing Hormone', abbreviation: 'LH', test_code: '10501-5', unit: 'mIU/mL', default_display_order: 2 },
      { test_name: 'Estradiol', abbreviation: 'E2', test_code: '2243-4', unit: 'pg/mL', default_display_order: 3 },
      { test_name: 'Progesterone', abbreviation: 'PROG', test_code: '2839-9', unit: 'ng/mL', default_display_order: 4 },
      { test_name: 'Testosterone', abbreviation: 'TEST', test_code: '2986-8', unit: 'ng/dL', default_display_order: 5 },
      { test_name: 'Sex Hormone Binding Globulin', abbreviation: 'SHBG', test_code: '13967-5', unit: 'nmol/L', default_display_order: 6 },
    ],
  },
  {
    id: 'tumor_markers',
    category: 'other',
    tests: [
      { test_name: 'Carcinoembryonic Antigen', abbreviation: 'CEA', test_code: '2039-6', unit: 'ng/mL', default_display_order: 1 },
      { test_name: 'CA 125', abbreviation: 'CA-125', test_code: '10334-1', unit: 'U/mL', default_display_order: 2 },
      { test_name: 'CA 19-9', abbreviation: 'CA 19-9', test_code: '24108-3', unit: 'U/mL', default_display_order: 3 },
      { test_name: 'Alpha-Fetoprotein', abbreviation: 'AFP', test_code: '1834-1', unit: 'ng/mL', default_display_order: 4 },
    ],
  },
  {
    id: 'urinalysis',
    category: 'chemistry',
    tests: [
      { test_name: 'Urinalysis pH', abbreviation: 'UA-pH', test_code: '2756-5', unit: '', default_display_order: 1 },
      { test_name: 'Urinalysis Specific Gravity', abbreviation: 'UA-SG', test_code: '5811-5', unit: '', default_display_order: 2 },
      { test_name: 'Urinalysis Protein', abbreviation: 'UA-PRO', test_code: '20454-5', unit: '', default_display_order: 3, result_type: 'qualitative' },
      { test_name: 'Urinalysis Glucose', abbreviation: 'UA-GLU', test_code: '25428-4', unit: '', default_display_order: 4, result_type: 'qualitative' },
      { test_name: 'Urinalysis Ketones', abbreviation: 'UA-KET', test_code: '2514-8', unit: '', default_display_order: 5, result_type: 'qualitative' },
      { test_name: 'Urinalysis Blood', abbreviation: 'UA-BLD', test_code: '5794-3', unit: '', default_display_order: 6, result_type: 'qualitative' },
      { test_name: 'Urinalysis Leukocyte Esterase', abbreviation: 'UA-LE', test_code: '5799-2', unit: '', default_display_order: 7, result_type: 'qualitative' },
      { test_name: 'Urinalysis Nitrite', abbreviation: 'UA-NIT', test_code: '5802-4', unit: '', default_display_order: 8, result_type: 'qualitative' },
    ],
  },
  {
    id: 'urine_culture',
    category: 'microbiology',
    tests: [
      { test_name: 'Urine Culture', abbreviation: 'UC', unit: '', default_display_order: 1, result_type: 'textual' },
    ],
  },
  {
    id: 'vitamin_d',
    category: 'chemistry',
    tests: [
      { test_name: '25-OH Vitamin D', abbreviation: 'Vit D', test_code: '14635-7', unit: 'ng/mL', default_display_order: 1 },
      { test_name: '1,25-Dihydroxyvitamin D', abbreviation: 'Vit D3', test_code: '1649-3', unit: 'pg/mL', default_display_order: 2 },
    ],
  },
  {
    id: 'vitamin_panel',
    category: 'chemistry',
    tests: [
      { test_name: 'Vitamin A', abbreviation: 'Vit A', test_code: '2923-1', unit: 'µg/dL', default_display_order: 1 },
      { test_name: 'Vitamin B12', abbreviation: 'B12', test_code: '2132-9', unit: 'pg/mL', default_display_order: 2 },
      { test_name: '25-OH Vitamin D', abbreviation: 'Vit D', test_code: '14635-7', unit: 'ng/mL', default_display_order: 3 },
      { test_name: 'Vitamin E', abbreviation: 'Vit E', test_code: '1823-4', unit: 'mg/L', default_display_order: 4 },
      { test_name: 'Folate', abbreviation: 'FOL', test_code: '2284-8', unit: 'ng/mL', default_display_order: 5 },
    ],
  },
];

const PANEL_NAME_TO_TEMPLATE_ID: Readonly<Record<string, string>> = {
  'Complete Blood Count': 'complete_blood_count',
  'CBC with Differential': 'complete_blood_count',
  'Basic Metabolic Panel': 'basic_metabolic_panel',
  'Comprehensive Metabolic Panel': 'comprehensive_metabolic_panel',
  'Lipid Panel': 'lipid_panel',
  'Thyroid Function Panel': 'thyroid_function',
  'Hepatic Function Panel': 'liver_function',
  'Renal Function Panel': 'kidney_function',
  'Autoimmune Panel': 'autoimmune_panel',
  'PSA Panel': 'psa_panel',
  'MRI': 'mri',
  'CT Scan': 'ct_scan',
  'X-Ray': 'x_ray',
  'Ultrasound': 'ultrasound',
  'Adrenal Function Panel': 'adrenal_function',
  'Allergy Testing Panel': 'allergy_testing',
  'B12 and Folate Panel': 'b12_folate',
  'BNP Panel': 'bnp_panel',
  'Blood Culture Panel': 'blood_culture',
  'Cardiac Enzyme Panel': 'cardiac_enzymes',
  'Coagulation Panel': 'coagulation',
  'Diabetes Monitoring Panel': 'diabetes_monitoring',
  'Drug Levels Panel': 'drug_levels',
  'Electrolytes Panel': 'electrolytes',
  'Glucose Tolerance Test': 'glucose_tolerance',
  'HIV Panel': 'hiv_panel',
  'Hepatitis Panel': 'hepatitis_panel',
  'Inflammatory Markers Panel': 'inflammatory_markers',
  'Iron Studies Panel': 'iron_studies',
  'Prenatal Panel': 'prenatal',
  'Respiratory Viral Panel': 'respiratory_viral',
  'Reticulocyte Count Panel': 'reticulocyte',
  'STI Panel': 'sti_panel',
  'Sex Hormone Panel': 'sex_hormones',
  'Tumor Markers Panel': 'tumor_markers',
  'Urinalysis': 'urinalysis',
  'Urine Culture and Sensitivity': 'urine_culture',
  'Vitamin D Panel': 'vitamin_d',
  'Vitamin Panel': 'vitamin_panel',
};

/** Returns ComponentRowData rows for a known panel name, or null if no template exists. */
export function getTemplateRowsForPanel(panelName: string): ComponentRowData[] | null {
  const templateId = PANEL_NAME_TO_TEMPLATE_ID[panelName];
  if (!templateId) return null;

  const template = PANEL_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  return template.tests.map((test, idx) => {
    const libraryMatch = getTestByName(test.test_name);
    return {
      ...createEmptyRow(test.default_display_order ?? idx + 1),
      test_name: test.test_name,
      canonical_test_name: libraryMatch?.test_name ?? null,
      abbreviation: test.abbreviation || '',
      test_code: test.test_code || '',
      unit: test.unit,
      category: template.category,
      display_order: test.default_display_order ?? idx + 1,
      notes: test.notes || '',
      result_type: test.result_type || ('quantitative' as 'quantitative' | 'qualitative' | 'textual'),
    };
  });
}
