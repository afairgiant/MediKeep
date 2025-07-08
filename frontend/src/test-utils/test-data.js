// Test data factories for Medical Records application

export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockAdmin = (overrides = {}) => ({
  id: 2,
  username: 'admin',
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockPatient = (overrides = {}) => ({
  id: 1,
  user_id: 1,
  first_name: 'John',
  last_name: 'Doe',
  birth_date: '1990-01-01',
  gender: 'M',
  address: '123 Main St, Anytown, NY 12345',
  blood_type: 'A+',
  height: 70,
  weight: 180,
  physician_id: 1,
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockPractitioner = (overrides = {}) => ({
  id: 1,
  name: 'Dr. John Smith',
  specialty: 'Family Medicine',
  phone_number: '555-0123',
  email: 'dr.smith@example.com',
  address: '456 Medical Center Dr, Anytown, NY 12345',
  website: 'https://drsmith.com',
  rating: 4.8,
  status: 'active',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockMedication = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  name: 'Lisinopril',
  dosage: '10mg',
  frequency: 'Daily',
  start_date: '2023-01-01',
  end_date: null,
  prescribing_doctor: 'Dr. John Smith',
  notes: 'For blood pressure management',
  status: 'active',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockLabResult = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  test_name: 'Complete Blood Count',
  test_date: '2023-06-15',
  result: 'Normal',
  reference_range: 'Within normal limits',
  ordering_doctor: 'Dr. John Smith',
  lab_name: 'LabCorp',
  notes: 'All values within normal range',
  status: 'completed',
  created_at: '2023-06-15T00:00:00',
  updated_at: '2023-06-15T00:00:00',
  ...overrides,
});

export const createMockVitals = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  measurement_date: '2023-12-01',
  systolic_bp: 120,
  diastolic_bp: 80,
  heart_rate: 72,
  temperature: 98.6,
  weight: 180,
  height: 70,
  bmi: 25.8,
  notes: 'Normal vital signs',
  created_at: '2023-12-01T00:00:00',
  updated_at: '2023-12-01T00:00:00',
  ...overrides,
});

export const createMockCondition = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  name: 'Hypertension',
  description: 'Essential hypertension',
  diagnosis_date: '2023-01-01',
  status: 'active',
  severity: 'mild',
  notes: 'Well controlled with medication',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockAllergy = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  allergen: 'Penicillin',
  reaction: 'Rash',
  severity: 'moderate',
  onset_date: '2020-01-01',
  notes: 'Developed rash after taking penicillin',
  status: 'active',
  created_at: '2020-01-01T00:00:00',
  updated_at: '2020-01-01T00:00:00',
  ...overrides,
});

export const createMockImmunization = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  vaccine_name: 'COVID-19 mRNA',
  vaccination_date: '2023-01-15',
  dose_number: 1,
  lot_number: 'ABC123',
  administered_by: 'Dr. Jane Wilson',
  location: 'Pharmacy',
  notes: 'No adverse reactions',
  status: 'completed',
  created_at: '2023-01-15T00:00:00',
  updated_at: '2023-01-15T00:00:00',
  ...overrides,
});

export const createMockProcedure = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  name: 'Annual Physical Exam',
  description: 'Comprehensive annual physical examination',
  procedure_date: '2023-06-01',
  performed_by: 'Dr. John Smith',
  location: 'Medical Center',
  notes: 'Patient in good health',
  status: 'completed',
  created_at: '2023-06-01T00:00:00',
  updated_at: '2023-06-01T00:00:00',
  ...overrides,
});

export const createMockTreatment = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  name: 'Physical Therapy',
  description: 'Physical therapy for lower back pain',
  start_date: '2023-01-01',
  end_date: '2023-02-01',
  provider: 'Sports Medicine Clinic',
  dosage: '3x per week',
  notes: 'Significant improvement in mobility',
  status: 'completed',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-02-01T00:00:00',
  ...overrides,
});

export const createMockEmergencyContact = (overrides = {}) => ({
  id: 1,
  patient_id: 1,
  name: 'Jane Doe',
  relationship: 'Spouse',
  phone_number: '555-0987',
  email: 'jane.doe@example.com',
  address: '123 Main St, Anytown, NY 12345',
  is_primary: true,
  notes: 'Primary emergency contact',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockPharmacy = (overrides = {}) => ({
  id: 1,
  name: 'CVS Pharmacy',
  phone_number: '555-0456',
  address: '789 Pharmacy Ave, Anytown, NY 12345',
  hours: 'Mon-Fri: 9AM-9PM, Sat-Sun: 9AM-6PM',
  services: ['Prescription filling', 'Vaccinations', 'Health screenings'],
  accepts_insurance: true,
  notes: 'Preferred pharmacy',
  status: 'active',
  created_at: '2023-01-01T00:00:00',
  updated_at: '2023-01-01T00:00:00',
  ...overrides,
});

export const createMockActivity = (overrides = {}) => ({
  id: 1,
  type: 'Medication',
  action: 'created',
  description: 'Created Medication: Lisinopril',
  timestamp: '2023-12-01T10:00:00',
  ...overrides,
});

export const createMockDashboardStats = (overrides = {}) => ({
  total_records: 25,
  active_medications: 3,
  recent_lab_results: 2,
  upcoming_appointments: 1,
  total_practitioners: 5,
  total_conditions: 2,
  total_allergies: 1,
  total_immunizations: 4,
  ...overrides,
});

// Helper function to create arrays of mock data
export const createMockArray = (factory, count = 3, baseOverrides = {}) => {
  return Array.from({ length: count }, (_, index) =>
    factory({ id: index + 1, ...baseOverrides })
  );
};

// Form data helpers for testing forms
export const createFormData = (type, overrides = {}) => {
  const formFactories = {
    patient: () => ({
      first_name: 'John',
      last_name: 'Doe',
      birth_date: '1990-01-01',
      gender: 'M',
      address: '123 Main St',
      blood_type: 'A+',
      height: '70',
      weight: '180',
      physician_id: '1',
    }),
    medication: () => ({
      name: 'Test Medication',
      dosage: '10mg',
      frequency: 'Daily',
      start_date: '2023-01-01',
      end_date: '',
      prescribing_doctor: 'Dr. Test',
      notes: 'Test notes',
      status: 'active',
    }),
    labResult: () => ({
      test_name: 'Test Lab',
      test_date: '2023-01-01',
      result: 'Normal',
      reference_range: 'Normal range',
      ordering_doctor: 'Dr. Test',
      lab_name: 'Test Lab',
      notes: 'Test notes',
      status: 'completed',
    }),
  };

  const factory = formFactories[type];
  if (!factory) {
    throw new Error(`Unknown form type: ${type}`);
  }

  return { ...factory(), ...overrides };
};