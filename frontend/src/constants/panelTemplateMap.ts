import { ComponentRowData, createEmptyRow } from '../utils/labTestComponentUtils';

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
  'MRI': 'mri',
  'CT Scan': 'ct_scan',
  'X-Ray': 'x_ray',
};

/** Returns ComponentRowData rows for a known panel name, or null if no template exists. */
export function getTemplateRowsForPanel(panelName: string): ComponentRowData[] | null {
  const templateId = PANEL_NAME_TO_TEMPLATE_ID[panelName];
  if (!templateId) return null;

  const template = PANEL_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  return template.tests.map((test, idx) => ({
    ...createEmptyRow(test.default_display_order ?? idx + 1),
    test_name: test.test_name,
    abbreviation: test.abbreviation || '',
    test_code: test.test_code || '',
    unit: test.unit,
    category: template.category,
    display_order: test.default_display_order ?? idx + 1,
    notes: test.notes || '',
    result_type: test.result_type || ('quantitative' as 'quantitative' | 'qualitative' | 'textual'),
  }));
}
