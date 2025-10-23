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
import Procedures from '../Procedures';

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

describe('Procedures Page Integration Tests', () => {
  const mockProcedures = [
    {
      id: 1,
      procedure_name: 'Colonoscopy',
      procedure_type: 'diagnostic',
      procedure_code: 'CPT-45378',
      procedure_setting: 'outpatient',
      description: 'Routine screening colonoscopy',
      procedure_date: '2024-01-15',
      status: 'completed',
      procedure_duration: 45,
      facility: 'Endoscopy Center',
      practitioner_id: 1,
      procedure_complications: null,
      notes: 'No abnormalities found',
      anesthesia_type: 'sedation',
      anesthesia_notes: 'Light sedation administered',
      patient_id: 1,
    },
    {
      id: 2,
      procedure_name: 'MRI Brain',
      procedure_type: 'diagnostic',
      procedure_code: 'CPT-70551',
      procedure_setting: 'outpatient',
      description: 'Brain MRI with contrast',
      procedure_date: '2024-02-01',
      status: 'scheduled',
      procedure_duration: 60,
      facility: 'Imaging Center',
      practitioner_id: 2,
      procedure_complications: null,
      notes: 'Patient has no metal implants',
      anesthesia_type: 'none',
      anesthesia_notes: null,
      patient_id: 1,
    },
    {
      id: 3,
      procedure_name: 'Appendectomy',
      procedure_type: 'surgical',
      procedure_code: 'CPT-44970',
      procedure_setting: 'inpatient',
      description: 'Laparoscopic appendectomy',
      procedure_date: '2023-12-10',
      status: 'completed',
      procedure_duration: 90,
      facility: 'General Hospital',
      practitioner_id: 1,
      procedure_complications: 'Minor bleeding controlled',
      notes: 'Surgery successful, recovery normal',
      anesthesia_type: 'general',
      anesthesia_notes: 'General anesthesia, patient tolerated well',
      patient_id: 1,
    },
  ];

  const mockPractitioners = [
    { id: 1, name: 'Dr. Wilson', specialty: 'Gastroenterology' },
    { id: 2, name: 'Dr. Martinez', specialty: 'Radiology' },
  ];

  beforeEach(() => {
    // Mock the hooks to return our test data
    const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
    const usePractitioners = require('../../../hooks/useGlobalData').usePractitioners;

    useMedicalData.mockReturnValue({
      items: mockProcedures,
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

    usePractitioners.mockReturnValue({
      practitioners: mockPractitioners,
    });

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/procedures', (req, res, ctx) => {
        return res(ctx.json(mockProcedures));
      }),
      rest.post('/api/v1/procedures', (req, res, ctx) => {
        const newProcedure = { id: 4, ...req.body };
        return res(ctx.json(newProcedure));
      }),
      rest.put('/api/v1/procedures/:id', (req, res, ctx) => {
        const updatedProcedure = { ...mockProcedures[0], ...req.body };
        return res(ctx.json(updatedProcedure));
      }),
      rest.delete('/api/v1/procedures/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders procedures page with initial data', async () => {
      renderWithPatient(<Procedures />);

      // Check page header
      expect(screen.getByText('Procedures')).toBeInTheDocument();
      
      // Check that procedures are displayed
      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
        expect(screen.getByText('MRI Brain')).toBeInTheDocument();
        expect(screen.getByText('Appendectomy')).toBeInTheDocument();
      });
    });

    test('displays different procedure types and statuses', async () => {
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        // Check procedure types
        expect(screen.getByText('Diagnostic')).toBeInTheDocument();
        expect(screen.getByText('Surgical')).toBeInTheDocument();

        // Check statuses
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
      });
    });

    test('shows procedure dates and facilities', async () => {
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Endoscopy Center')).toBeInTheDocument();
        expect(screen.getByText('Imaging Center')).toBeInTheDocument();
        expect(screen.getByText('General Hospital')).toBeInTheDocument();
      });
    });
  });

  describe('Procedure CRUD Operations', () => {
    test('creates a new procedure through complete workflow', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockProcedures,
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

      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Add Procedure')).toBeInTheDocument();
      });

      // Click Add Procedure button
      const addButton = screen.getByText('Add Procedure');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Procedure')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Procedure Name *'), 'Blood Test');
      
      // Select procedure type
      await userEvent.click(screen.getByLabelText('Procedure Type'));
      await userEvent.click(screen.getByText('Diagnostic - Testing/Imaging'));

      await userEvent.type(screen.getByLabelText('Procedure Code'), 'CPT-80053');
      
      // Select setting
      await userEvent.click(screen.getByLabelText('Procedure Setting'));
      await userEvent.click(screen.getByText('Office - Doctor office/clinic'));

      await userEvent.type(screen.getByLabelText('Description'), 'Comprehensive metabolic panel');

      // Set procedure date
      const dateInput = screen.getByTestId('date-procedure-date');
      await userEvent.type(dateInput, '2024-02-15');

      // Select status
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Scheduled - Planned for future'));

      await userEvent.type(screen.getByLabelText('Duration (minutes)'), '15');
      await userEvent.type(screen.getByLabelText('Facility'), 'Lab Services');

      // Select practitioner
      await userEvent.click(screen.getByLabelText('Performing Practitioner'));
      await userEvent.click(screen.getByText('Dr. Wilson - Gastroenterology'));

      // Add notes
      await userEvent.type(screen.getByLabelText('Clinical Notes'), 'Routine blood work');

      // Submit form
      const submitButton = screen.getByText('Add Procedure');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        procedure_name: 'Blood Test',
        procedure_type: 'diagnostic',
        procedure_code: 'CPT-80053',
        procedure_setting: 'office',
        description: 'Comprehensive metabolic panel',
        procedure_date: '2024-02-15',
        status: 'scheduled',
        procedure_duration: '15',
        facility: 'Lab Services',
        practitioner_id: '1',
        procedure_complications: '',
        notes: 'Routine blood work',
        anesthesia_type: '',
        anesthesia_notes: '',
      });
    });

    test('edits existing procedure with anesthesia information', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockProcedures,
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

      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Find and click edit button
      const editButtons = screen.getAllByText('Edit');
      await userEvent.click(editButtons[0]);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Procedure')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Colonoscopy')).toBeInTheDocument();

      // Update status to completed
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Completed - Successfully finished'));

      // Add complications
      const complicationsField = screen.getByLabelText('Complications');
      await userEvent.type(complicationsField, 'Small polyp removed');

      // Update anesthesia notes
      const anesthesiaNotesField = screen.getByLabelText('Anesthesia Notes');
      await userEvent.clear(anesthesiaNotesField);
      await userEvent.type(anesthesiaNotesField, 'Conscious sedation administered, no complications');

      // Submit changes
      const updateButton = screen.getByText('Update Procedure');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'completed',
        procedure_complications: 'Small polyp removed',
        anesthesia_notes: 'Conscious sedation administered, no complications',
      }));
    });

    test('deletes procedure with confirmation', async () => {
      
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockProcedures,
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

      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButtons = screen.getAllByText('Delete');
      await userEvent.click(deleteButtons[0]);

      // Confirmation dialog should appear
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this procedure/)).toBeInTheDocument();

      // Confirm deletion
      const confirmButton = screen.getByText('Delete');
      await userEvent.click(confirmButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('Filtering and Search', () => {
    test('filters procedures by type', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Apply diagnostic filter
      const typeFilter = screen.getByLabelText('Type');
      await userEvent.click(typeFilter);
      await userEvent.click(screen.getByText('Diagnostic'));

      // Should only show diagnostic procedures
      expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      expect(screen.getByText('MRI Brain')).toBeInTheDocument();
      expect(screen.queryByText('Appendectomy')).not.toBeInTheDocument();
    });

    test('filters procedures by status', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Apply completed filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Completed'));

      // Should only show completed procedures
      expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      expect(screen.getByText('Appendectomy')).toBeInTheDocument();
      expect(screen.queryByText('MRI Brain')).not.toBeInTheDocument();
    });

    test('searches procedures by name and description', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Search for MRI
      const searchInput = screen.getByPlaceholderText('Search procedures...');
      await userEvent.type(searchInput, 'MRI');

      // Should only show MRI procedure
      expect(screen.getByText('MRI Brain')).toBeInTheDocument();
      expect(screen.queryByText('Colonoscopy')).not.toBeInTheDocument();
      expect(screen.queryByText('Appendectomy')).not.toBeInTheDocument();
    });
  });

  describe('Procedure Details and Information', () => {
    test('displays comprehensive procedure information', async () => {
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Check that all important information is displayed
      expect(screen.getByText('CPT-45378')).toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();
      expect(screen.getByText('Dr. Wilson')).toBeInTheDocument();
      expect(screen.getByText('Sedation')).toBeInTheDocument();
    });

    test('opens detailed view modal', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Click on procedure name to view details
      await userEvent.click(screen.getByText('Colonoscopy'));

      // Details modal should open
      expect(screen.getByText('Procedure Details')).toBeInTheDocument();
      expect(screen.getByText('Routine screening colonoscopy')).toBeInTheDocument();
      expect(screen.getByText('No abnormalities found')).toBeInTheDocument();
      expect(screen.getByText('Light sedation administered')).toBeInTheDocument();
    });

    test('shows surgical procedure with complications', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Appendectomy')).toBeInTheDocument();
      });

      // Click to view surgical procedure details
      await userEvent.click(screen.getByText('Appendectomy'));

      // Should show surgical details including complications
      expect(screen.getByText('Laparoscopic appendectomy')).toBeInTheDocument();
      expect(screen.getByText('Minor bleeding controlled')).toBeInTheDocument();
      expect(screen.getByText('General anesthesia, patient tolerated well')).toBeInTheDocument();
    });
  });

  describe('Date Handling and Timeline', () => {
    test('displays procedures in chronological order', async () => {
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
      });

      // Procedures should be ordered by date (most recent first)
      const procedureElements = screen.getAllByTestId('procedure-card');
      expect(procedureElements[0]).toHaveTextContent('MRI Brain'); // Feb 1, 2024
      expect(procedureElements[1]).toHaveTextContent('Colonoscopy'); // Jan 15, 2024
      expect(procedureElements[2]).toHaveTextContent('Appendectomy'); // Dec 10, 2023
    });

    test('validates date inputs in form', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Add Procedure')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Procedure');
      await userEvent.click(addButton);

      // Try to set future date for completed procedure
      const dateInput = screen.getByTestId('date-procedure-date');
      await userEvent.type(dateInput, '2025-12-31');

      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Completed - Successfully finished'));

      // Should show validation warning
      expect(screen.getByText('Completed procedures should not have future dates')).toBeInTheDocument();
    });
  });

  describe('Medical Workflow Integration', () => {
    test('supports pre-procedure to post-procedure workflow', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('MRI Brain')).toBeInTheDocument();
      });

      // Edit scheduled procedure to in-progress
      const editButtons = screen.getAllByText('Edit');
      await userEvent.click(editButtons[1]); // MRI Brain

      // Change status to in-progress
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('In Progress - Currently happening'));

      // Add real-time notes
      const notesField = screen.getByLabelText('Clinical Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Procedure in progress, patient stable');

      const updateButton = screen.getByText('Update Procedure');
      await userEvent.click(updateButton);

      // Verify update
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    test('handles emergency procedure documentation', async () => {
      
      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Add Procedure')).toBeInTheDocument();
      });

      // Create emergency procedure
      const addButton = screen.getByText('Add Procedure');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Procedure Name *'), 'Emergency Appendectomy');
      
      await userEvent.click(screen.getByLabelText('Procedure Type'));
      await userEvent.click(screen.getByText('Emergency - Urgent care'));

      await userEvent.click(screen.getByLabelText('Procedure Setting'));
      await userEvent.click(screen.getByText('Emergency - ER/urgent care'));

      const dateInput = screen.getByTestId('date-procedure-date');
      await userEvent.type(dateInput, '2024-02-10');

      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Completed - Successfully finished'));

      await userEvent.type(screen.getByLabelText('Clinical Notes'), 'Emergency appendectomy performed due to acute appendicitis');

      const submitButton = screen.getByText('Add Procedure');
      await userEvent.click(submitButton);

      // Should create emergency procedure successfully
      expect(screen.getByText('Emergency Appendectomy')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles network errors gracefully', async () => {
      
      const mockCreateItem = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockProcedures,
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

      renderWithPatient(<Procedures />);

      await waitFor(() => {
        expect(screen.getByText('Add Procedure')).toBeInTheDocument();
      });

      // Try to create procedure
      const addButton = screen.getByText('Add Procedure');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Procedure Name *'), 'Test Procedure');
      
      const submitButton = screen.getByText('Add Procedure');
      await userEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create procedure')).toBeInTheDocument();
      });
    });

    test('handles empty practitioner list', () => {
      const usePractitioners = require('../../../hooks/useGlobalData').usePractitioners;
      usePractitioners.mockReturnValue({
        practitioners: [],
      });

      renderWithPatient(<Procedures />);

      // Should still render without errors
      expect(screen.getByText('Procedures')).toBeInTheDocument();
    });
  });
});
