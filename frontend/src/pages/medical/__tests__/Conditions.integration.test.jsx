import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { renderWithPatient } from '../../../test-utils/render';
import { server } from '../../../test-utils/mocks/server';
import Conditions from '../Conditions';

// Mock the hooks that make API calls
vi.mock('../../../hooks/useMedicalData');
vi.mock('../../../hooks/useGlobalData');

// Mock date inputs
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, value, onChange, required, ...props }) => (
    <div>
      <label htmlFor={`date-${label}`}>{label}{required && ' *'}</label>
      <input
        id={`date-${label}`}
        type="date"
        value={value ? (value instanceof Date ? value.toISOString().split('T')[0] : value) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
        data-testid={`date-${label.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
    </div>
  ),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('Conditions Page Integration Tests', () => {
  const mockConditions = [
    {
      id: 1,
      diagnosis: 'Type 2 Diabetes',
      status: 'active',
      severity: 'moderate',
      icd10_code: 'E11.9',
      snomed_code: '44054006',
      code_description: 'Type 2 diabetes mellitus without complications',
      onset_date: '2020-03-15',
      end_date: null,
      notes: 'Well controlled with medication',
      patient_id: 1,
    },
    {
      id: 2,
      diagnosis: 'Hypertension',
      status: 'active',
      severity: 'mild',
      icd10_code: 'I10',
      snomed_code: '38341003',
      code_description: 'Essential hypertension',
      onset_date: '2019-08-20',
      end_date: null,
      notes: 'Managed with ACE inhibitor',
      patient_id: 1,
    },
    {
      id: 3,
      diagnosis: 'Seasonal Allergies',
      status: 'resolved',
      severity: 'mild',
      icd10_code: 'J30.1',
      snomed_code: '21719001',
      code_description: 'Allergic rhinitis due to pollen',
      onset_date: '2023-04-01',
      end_date: '2023-06-30',
      notes: 'Resolved after allergy season',
      patient_id: 1,
    },
  ];

  beforeEach(() => {
    // Mock the hooks to return our test data
    const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;

    useMedicalData.mockReturnValue({
      items: mockConditions,
      currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
      loading: false,
      error: null,
      successMessage: null,
      createItem: vi.fn().mockResolvedValue({}),
      updateItem: vi.fn().mockResolvedValue({}),
      deleteItem: vi.fn().mockResolvedValue({}),
      refreshData: vi.fn(),
      clearError: vi.fn(),
      setError: vi.fn(),
    });

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/conditions', (req, res, ctx) => {
        return res(ctx.json(mockConditions));
      }),
      rest.post('/api/v1/conditions', (req, res, ctx) => {
        const newCondition = { id: 4, ...req.body };
        return res(ctx.json(newCondition));
      }),
      rest.put('/api/v1/conditions/:id', (req, res, ctx) => {
        const updatedCondition = { ...mockConditions[0], ...req.body };
        return res(ctx.json(updatedCondition));
      }),
      rest.delete('/api/v1/conditions/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders conditions page with initial data', async () => {
      renderWithPatient(<Conditions />);

      // Check page header
      expect(screen.getByText('Medical Conditions')).toBeInTheDocument();
      
      // Check that conditions are displayed
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
        expect(screen.getByText('Seasonal Allergies')).toBeInTheDocument();
      });
    });

    test('displays condition details with medical codes and severity', async () => {
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Check medical codes are displayed
      expect(screen.getByText('ICD-10: E11.9')).toBeInTheDocument();
      expect(screen.getByText('SNOMED: 44054006')).toBeInTheDocument();

      // Check severity badges
      expect(screen.getByText('moderate')).toBeInTheDocument();
      expect(screen.getByText('mild')).toBeInTheDocument();

      // Check status badges
      expect(screen.getAllByText('active')).toHaveLength(2);
      expect(screen.getByText('resolved')).toBeInTheDocument();
    });

    test('shows onset dates and duration calculations', async () => {
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Should show onset dates formatted
      expect(screen.getByText('Mar 15, 2020')).toBeInTheDocument();
      expect(screen.getByText('Aug 20, 2019')).toBeInTheDocument();

      // Should show duration calculations (these are relative, so just check they exist)
      const durationElements = screen.getAllByText(/years? ago|months? ago|days? ago/);
      expect(durationElements.length).toBeGreaterThan(0);
    });
  });

  describe('Condition CRUD Operations', () => {
    test('creates a new condition through complete workflow', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockConditions,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: mockCreateItem,
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Click Add New Condition button
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Condition')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Diagnosis *'), 'Migraine Headache');
      
      // Select severity
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Moderate - Moderate symptoms'));

      // Select status
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Active - Currently ongoing'));

      // Add medical codes
      await userEvent.type(screen.getByLabelText('ICD-10 Code'), 'G43.9');
      await userEvent.type(screen.getByLabelText('SNOMED Code'), '37796009');
      await userEvent.type(screen.getByLabelText('Code Description'), 'Migraine without aura');

      // Set onset date
      const onsetDateInput = screen.getByTestId('date-onset-date');
      await userEvent.type(onsetDateInput, '2023-01-15');

      // Add notes
      await userEvent.type(screen.getByLabelText('Clinical Notes'), 'Chronic migraine, responds well to triptans');

      // Submit form
      const submitButton = screen.getByText('Add Condition');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        diagnosis: 'Migraine Headache',
        status: 'active',
        severity: 'moderate',
        icd10_code: 'G43.9',
        snomed_code: '37796009',
        code_description: 'Migraine without aura',
        onset_date: '2023-01-15',
        end_date: null,
        notes: 'Chronic migraine, responds well to triptans',
        patient_id: 1,
      });
    });

    test('edits existing condition with updated severity and notes', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockConditions,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: vi.fn(),
        updateItem: mockUpdateItem,
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Find and click edit button for Type 2 Diabetes
      const diabetesCard = screen.getByText('Type 2 Diabetes').closest('[role="button"], .mantine-Card-root, .card');
      const editButton = within(diabetesCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Condition')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Type 2 Diabetes')).toBeInTheDocument();

      // Update severity to severe
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Severe - Severe symptoms'));

      // Update notes
      const notesField = screen.getByLabelText('Clinical Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Diabetes now requiring insulin therapy, poor glycemic control');

      // Submit changes
      const updateButton = screen.getByText('Update Condition');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(1, expect.objectContaining({
        severity: 'severe',
        notes: 'Diabetes now requiring insulin therapy, poor glycemic control',
      }));
    });

    test('deletes condition with confirmation', async () => {
      
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockConditions,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: mockDeleteItem,
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Find and click delete button
      const diabetesCard = screen.getByText('Type 2 Diabetes').closest('[role="button"], .mantine-Card-root, .card');
      const deleteButton = within(diabetesCard || document.body).getByText('Delete');
      await userEvent.click(deleteButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('Filtering and Search', () => {
    test('filters conditions by status', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Initially shows all conditions
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.getByText('Seasonal Allergies')).toBeInTheDocument();

      // Apply active filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Active'));

      // Should only show active conditions
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.queryByText('Seasonal Allergies')).not.toBeInTheDocument();
    });

    test('filters conditions by severity', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Apply moderate severity filter
      const severityFilter = screen.getByLabelText('Severity');
      await userEvent.click(severityFilter);
      await userEvent.click(screen.getByText('Moderate'));

      // Should only show moderate severity conditions
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
      expect(screen.queryByText('Seasonal Allergies')).not.toBeInTheDocument();
    });

    test('searches conditions by diagnosis name', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Search for diabetes
      const searchInput = screen.getByPlaceholderText('Search conditions...');
      await userEvent.type(searchInput, 'diabetes');

      // Should only show diabetes condition
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
      expect(screen.queryByText('Seasonal Allergies')).not.toBeInTheDocument();
    });
  });

  describe('Condition Details View', () => {
    test('opens detailed view modal with comprehensive information', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Click on condition name to view details
      await userEvent.click(screen.getByText('Type 2 Diabetes'));

      // Details modal should open
      expect(screen.getByText('Condition Details')).toBeInTheDocument();
      expect(screen.getByText('Type 2 diabetes mellitus without complications')).toBeInTheDocument();

      // Should show all medical information
      expect(screen.getByText('E11.9')).toBeInTheDocument(); // ICD-10
      expect(screen.getByText('44054006')).toBeInTheDocument(); // SNOMED
      expect(screen.getByText('Well controlled with medication')).toBeInTheDocument(); // Notes
    });

    test('shows timeline information with duration calculation', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Click view button
      const diabetesCard = screen.getByText('Type 2 Diabetes').closest('[role="button"], .mantine-Card-root, .card');
      const viewButton = within(diabetesCard || document.body).getByText('View');
      await userEvent.click(viewButton);

      // Should show timeline information
      expect(screen.getByText('TIMELINE')).toBeInTheDocument();
      expect(screen.getByText('Mar 15, 2020')).toBeInTheDocument(); // Formatted onset date

      // Should show duration calculation
      const durationText = screen.getByText(/years? ago|months? ago|days? ago/);
      expect(durationText).toBeInTheDocument();
    });

    test('displays resolved condition with end date', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Seasonal Allergies')).toBeInTheDocument();
      });

      // Click on resolved condition
      await userEvent.click(screen.getByText('Seasonal Allergies'));

      // Should show end date
      expect(screen.getByText('Jun 30, 2023')).toBeInTheDocument();
      expect(screen.getByText('resolved')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Initially in cards view
      expect(screen.getByText('Cards')).toBeInTheDocument();

      // Switch to table view
      const tableButton = screen.getByText('Table');
      await userEvent.click(tableButton);

      // Should now show table headers
      expect(screen.getByText('Condition')).toBeInTheDocument();
      expect(screen.getByText('Severity')).toBeInTheDocument();
      expect(screen.getByText('Onset Date')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Medical Workflow Integration', () => {
    test('manages chronic condition lifecycle', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Edit active condition to chronic
      const diabetesCard = screen.getByText('Type 2 Diabetes').closest('[role="button"], .mantine-Card-root, .card');
      const editButton = within(diabetesCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Change status to chronic
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Chronic - Long-term ongoing'));

      // Add long-term management notes
      const notesField = screen.getByLabelText('Clinical Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Chronic diabetes managed with metformin and lifestyle modifications. Regular HbA1c monitoring every 3 months.');

      const updateButton = screen.getByText('Update Condition');
      await userEvent.click(updateButton);

      // Verify chronic status update
      expect(screen.getByText('chronic')).toBeInTheDocument();
    });

    test('handles condition resolution workflow', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Create a new acute condition
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Diagnosis *'), 'Acute Bronchitis');
      
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Mild - Mild symptoms'));

      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Active - Currently ongoing'));

      // Set onset date
      const onsetDateInput = screen.getByTestId('date-onset-date');
      await userEvent.type(onsetDateInput, '2024-01-10');

      await userEvent.type(screen.getByLabelText('Clinical Notes'), 'Acute bronchitis with productive cough');

      const submitButton = screen.getByText('Add Condition');
      await userEvent.click(submitButton);

      // Should create acute condition successfully
      expect(screen.getByText('Acute Bronchitis')).toBeInTheDocument();
    });

    test('validates medical coding integrity', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Create condition with comprehensive medical coding
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Diagnosis *'), 'Atrial Fibrillation');
      await userEvent.type(screen.getByLabelText('ICD-10 Code'), 'I48.0');
      await userEvent.type(screen.getByLabelText('SNOMED Code'), '49436004');
      await userEvent.type(screen.getByLabelText('Code Description'), 'Paroxysmal atrial fibrillation');

      const submitButton = screen.getByText('Add Condition');
      await userEvent.click(submitButton);

      // Should show medical codes are properly captured
      expect(screen.getByText('ICD-10: I48.0')).toBeInTheDocument();
      expect(screen.getByText('SNOMED: 49436004')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      
      const mockCreateItem = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockConditions,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: mockCreateItem,
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Try to create condition
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Diagnosis *'), 'Test Condition');
      
      const submitButton = screen.getByText('Add Condition');
      await userEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create condition')).toBeInTheDocument();
      });
    });

    test('handles conditions without medical codes', () => {
      const conditionsWithoutCodes = [
        {
          id: 1,
          diagnosis: 'General Fatigue',
          status: 'active',
          severity: null,
          icd10_code: null,
          snomed_code: null,
          code_description: null,
          onset_date: '2024-01-01',
          end_date: null,
          notes: 'Patient reports general fatigue',
          patient_id: 1,
        },
      ];

      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: conditionsWithoutCodes,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      // Should still render without errors
      expect(screen.getByText('Medical Conditions')).toBeInTheDocument();
      expect(screen.getByText('General Fatigue')).toBeInTheDocument();
    });

    test('displays empty state when no conditions exist', () => {
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: [],
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Conditions />);

      expect(screen.getByText('No medical conditions found')).toBeInTheDocument();
      expect(screen.getByText('Click "Add New Condition" to get started.')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates required diagnosis field', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      // Try to submit without diagnosis
      const submitButton = screen.getByText('Add Condition');
      await userEvent.click(submitButton);

      // Should show validation error
      expect(screen.getByText('Diagnosis is required')).toBeInTheDocument();
    });

    test('validates date fields for logical consistency', async () => {
      
      renderWithPatient(<Conditions />);

      await waitFor(() => {
        expect(screen.getByText('Add New Condition')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add New Condition');
      await userEvent.click(addButton);

      // Set end date before onset date
      const onsetDateInput = screen.getByTestId('date-onset-date');
      const endDateInput = screen.getByTestId('date-end-date');
      
      await userEvent.type(onsetDateInput, '2024-02-01');
      await userEvent.type(endDateInput, '2024-01-01');

      // Should show validation error
      expect(screen.getByText('End date must be after onset date')).toBeInTheDocument();
    });
  });
});
