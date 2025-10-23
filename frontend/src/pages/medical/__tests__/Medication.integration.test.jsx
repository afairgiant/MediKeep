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
import Medication from '../Medication';

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

describe('Medication Page Integration Tests', () => {
  const mockMedications = [
    {
      id: 1,
      medication_name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Daily',
      route: 'Oral',
      indication: 'High blood pressure',
      effective_period_start: '2024-01-01',
      effective_period_end: null,
      status: 'active',
      practitioner_id: 1,
      pharmacy_id: 1,
      patient_id: 1,
    },
    {
      id: 2,
      medication_name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      route: 'Oral',
      indication: 'Type 2 diabetes',
      effective_period_start: '2023-12-15',
      effective_period_end: null,
      status: 'active',
      practitioner_id: 2,
      pharmacy_id: 1,
      patient_id: 1,
    },
    {
      id: 3,
      medication_name: 'Ibuprofen',
      dosage: '200mg',
      frequency: 'As needed',
      route: 'Oral',
      indication: 'Pain relief',
      effective_period_start: '2024-01-10',
      effective_period_end: '2024-01-20',
      status: 'completed',
      practitioner_id: 1,
      pharmacy_id: 2,
      patient_id: 1,
    },
  ];

  const mockPractitioners = [
    { id: 1, name: 'Dr. Smith', specialty: 'Family Medicine' },
    { id: 2, name: 'Dr. Johnson', specialty: 'Endocrinology' },
  ];

  const mockPharmacies = [
    { id: 1, name: 'CVS Pharmacy - Main St' },
    { id: 2, name: 'Walgreens - Downtown' },
  ];

  beforeEach(() => {
    // Mock the hooks to return our test data
    const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
    const usePatientWithStaticData = require('../../../hooks/useGlobalData').usePatientWithStaticData;

    useMedicalData.mockReturnValue({
      items: mockMedications,
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

    usePatientWithStaticData.mockReturnValue({
      practitioners: { practitioners: mockPractitioners },
      pharmacies: { pharmacies: mockPharmacies },
    });

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/medications', (req, res, ctx) => {
        return res(ctx.json(mockMedications));
      }),
      rest.post('/api/v1/medications', (req, res, ctx) => {
        const newMedication = { id: 4, ...req.body };
        return res(ctx.json(newMedication));
      }),
      rest.put('/api/v1/medications/:id', (req, res, ctx) => {
        const updatedMedication = { ...mockMedications[0], ...req.body };
        return res(ctx.json(updatedMedication));
      }),
      rest.delete('/api/v1/medications/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders medication page with initial data', async () => {
      renderWithPatient(<Medication />);

      // Check page header
      expect(screen.getByText('Medications')).toBeInTheDocument();
      
      // Check that medications are displayed
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Metformin')).toBeInTheDocument();
        expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
      });
    });

    test('displays loading state initially', () => {
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: [],
        loading: true,
        error: null,
        currentPatient: null,
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Medication />);

      expect(screen.getByText('Loading medications...')).toBeInTheDocument();
    });

    test('displays error state when there is an error', () => {
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: [],
        loading: false,
        error: 'Failed to load medications',
        currentPatient: { id: 1 },
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Medication />);

      expect(screen.getByText('Failed to load medications')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Initially in cards view
      expect(screen.getByText('Cards')).toBeInTheDocument();

      // Switch to table view
      const tableButton = screen.getByText('Table');
      await userEvent.click(tableButton);

      // Should now show table headers
      expect(screen.getByText('Medication')).toBeInTheDocument();
      expect(screen.getByText('Dosage')).toBeInTheDocument();
      expect(screen.getByText('Frequency')).toBeInTheDocument();
    });
  });

  describe('Medication CRUD Operations', () => {
    test('creates a new medication through the complete workflow', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockMedications,
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

      renderWithPatient(<Medication />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Click Add Medication button
      const addButton = screen.getByText('Add Medication');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Medication')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Medication Name *'), 'Aspirin');
      await userEvent.type(screen.getByLabelText('Dosage'), '81mg');
      await userEvent.type(screen.getByLabelText('Frequency'), 'Daily');
      await userEvent.type(screen.getByLabelText('Indication'), 'Blood thinner');

      // Select route
      await userEvent.click(screen.getByLabelText('Route of Administration'));
      await userEvent.click(screen.getByText('Oral - By mouth'));

      // Select practitioner
      await userEvent.click(screen.getByLabelText('Prescribing Practitioner'));
      await userEvent.click(screen.getByText('Dr. Smith - Family Medicine'));

      // Set start date
      const startDateInput = screen.getByTestId('date-start-date');
      await userEvent.type(startDateInput, '2024-02-01');

      // Submit form
      const submitButton = screen.getByText('Add Medication');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        medication_name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Daily',
        route: 'oral',
        indication: 'Blood thinner',
        effective_period_start: '2024-02-01',
        effective_period_end: '',
        status: 'active',
        practitioner_id: '1',
        pharmacy_id: '',
      });
    });

    test('edits an existing medication', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockMedications,
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

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Find and click edit button for first medication
      const medicationCards = screen.getAllByText('Edit');
      await userEvent.click(medicationCards[0]);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Medication')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Lisinopril')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10mg')).toBeInTheDocument();

      // Modify the dosage
      const dosageInput = screen.getByLabelText('Dosage');
      await userEvent.clear(dosageInput);
      await userEvent.type(dosageInput, '20mg');

      // Submit changes
      const updateButton = screen.getByText('Update Medication');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(1, expect.objectContaining({
        dosage: '20mg',
      }));
    });

    test('deletes a medication with confirmation', async () => {
      
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockMedications,
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

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Delete');
      await userEvent.click(deleteButtons[0]);

      // Confirmation dialog should appear
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('Filtering and Search', () => {
    test('filters medications by status', async () => {
      
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Initially shows all medications
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen')).toBeInTheDocument();

      // Apply active filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Active'));

      // Should only show active medications
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.queryByText('Ibuprofen')).not.toBeInTheDocument();
    });

    test('searches medications by name', async () => {
      
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Search for specific medication
      const searchInput = screen.getByPlaceholderText('Search medications...');
      await userEvent.type(searchInput, 'Lisinopril');

      // Should only show matching medication
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.queryByText('Metformin')).not.toBeInTheDocument();
      expect(screen.queryByText('Ibuprofen')).not.toBeInTheDocument();
    });
  });

  describe('Medication Details View', () => {
    test('opens detailed view modal', async () => {
      
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Click on medication name to view details
      await userEvent.click(screen.getByText('Lisinopril'));

      // Details modal should open
      expect(screen.getByText('Medication Details')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('10mg')).toBeInTheDocument();
      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('High blood pressure')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('validates required fields', async () => {
      
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Add Medication')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Medication');
      await userEvent.click(addButton);

      // Try to submit without required fields
      const submitButton = screen.getByText('Add Medication');
      await userEvent.click(submitButton);

      // Should show validation errors
      expect(screen.getByText('Medication name is required')).toBeInTheDocument();
    });

    test('validates date fields', async () => {
      
      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Add Medication')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Medication');
      await userEvent.click(addButton);

      // Set end date before start date
      const startDateInput = screen.getByTestId('date-start-date');
      const endDateInput = screen.getByTestId('date-end-date');
      
      await userEvent.type(startDateInput, '2024-02-01');
      await userEvent.type(endDateInput, '2024-01-01');

      // Should show validation error
      expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      
      const mockCreateItem = vi.fn().mockRejectedValue(new Error('API Error'));
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockMedications,
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

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Add Medication')).toBeInTheDocument();
      });

      // Try to create medication
      const addButton = screen.getByText('Add Medication');
      await userEvent.click(addButton);

      // Fill required field
      await userEvent.type(screen.getByLabelText('Medication Name *'), 'Test Med');

      // Submit
      const submitButton = screen.getByText('Add Medication');
      await userEvent.click(submitButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.getByText('Failed to create medication')).toBeInTheDocument();
      });
    });
  });

  describe('Success Messages', () => {
    test('displays success message after successful operation', async () => {
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockMedications,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: 'Medication created successfully',
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
        refreshData: vi.fn(),
        clearError: vi.fn(),
        setError: vi.fn(),
      });

      renderWithPatient(<Medication />);

      expect(screen.getByText('Medication created successfully')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('adapts to mobile view', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithPatient(<Medication />);

      // Should show mobile-optimized layout (cards view is used for mobile)
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });
  });
});
