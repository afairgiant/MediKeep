/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { renderWithPatient } from '../../../test-utils/render';
import { server } from '../../../test-utils/mocks/server';
import Allergies from '../Allergies';

// Mock the hooks that make API calls
jest.mock('../../../hooks/useMedicalData');
jest.mock('../../../hooks/useDataManagement');

// Mock date inputs
jest.mock('@mantine/dates', () => ({
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
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('Allergies Page Integration Tests', () => {
  const mockAllergies = [
    {
      id: 1,
      allergen: 'Penicillin',
      severity: 'severe',
      reaction: 'Anaphylaxis, difficulty breathing, hives',
      onset_date: '2020-05-15',
      status: 'active',
      notes: 'Confirmed by allergist. Carry EpiPen at all times.',
      patient_id: 1,
    },
    {
      id: 2,
      allergen: 'Peanuts',
      severity: 'life-threatening',
      reaction: 'Anaphylactic shock, swelling of throat',
      onset_date: '2018-03-10',
      status: 'active',
      notes: 'Severe peanut allergy. Avoid all nuts and processed foods.',
      patient_id: 1,
    },
    {
      id: 3,
      allergen: 'Latex',
      severity: 'moderate',
      reaction: 'Contact dermatitis, rash',
      onset_date: '2021-08-22',
      status: 'active',
      notes: 'Occupational allergy. Use non-latex gloves.',
      patient_id: 1,
    },
    {
      id: 4,
      allergen: 'Shellfish',
      severity: 'mild',
      reaction: 'Stomach upset, nausea',
      onset_date: '2019-12-01',
      status: 'resolved',
      notes: 'Previously allergic, seems to have outgrown it.',
      patient_id: 1,
    },
  ];

  // Mock data management hook
  const mockDataManagement = {
    data: mockAllergies,
    filters: {
      search: '',
      status: '',
      severity: '',
    },
    updateFilter: jest.fn(),
    clearFilters: jest.fn(),
    hasActiveFilters: false,
    statusOptions: [
      { value: 'active', label: 'Active' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'inactive', label: 'Inactive' },
    ],
    categoryOptions: [],
    dateRangeOptions: [],
    sortOptions: [],
    sortBy: 'allergen',
    sortOrder: 'asc',
    handleSortChange: jest.fn(),
    totalCount: mockAllergies.length,
    filteredCount: mockAllergies.length,
  };

  beforeEach(() => {
    // Mock the hooks to return our test data
    const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
    const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;

    useMedicalData.mockReturnValue({
      items: mockAllergies,
      currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
      loading: false,
      error: null,
      successMessage: null,
      createItem: jest.fn().mockResolvedValue({}),
      updateItem: jest.fn().mockResolvedValue({}),
      deleteItem: jest.fn().mockResolvedValue({}),
      refreshData: jest.fn(),
      clearError: jest.fn(),
      setError: jest.fn(),
    });

    useDataManagement.mockReturnValue(mockDataManagement);

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/allergies', (req, res, ctx) => {
        return res(ctx.json(mockAllergies));
      }),
      rest.post('/api/v1/allergies', (req, res, ctx) => {
        const newAllergy = { id: 5, ...req.body };
        return res(ctx.json(newAllergy));
      }),
      rest.put('/api/v1/allergies/:id', (req, res, ctx) => {
        const updatedAllergy = { ...mockAllergies[0], ...req.body };
        return res(ctx.json(updatedAllergy));
      }),
      rest.delete('/api/v1/allergies/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders allergies page with initial data', async () => {
      renderWithPatient(<Allergies />);

      // Check page header
      expect(screen.getByText('Allergies')).toBeInTheDocument();
      
      // Check that allergies are displayed
      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
        expect(screen.getByText('Peanuts')).toBeInTheDocument();
        expect(screen.getByText('Latex')).toBeInTheDocument();
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
      });
    });

    test('displays allergy severity levels and reactions', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Check severity badges are displayed correctly
      expect(screen.getByText('severe')).toBeInTheDocument();
      expect(screen.getByText('life-threatening')).toBeInTheDocument();
      expect(screen.getByText('moderate')).toBeInTheDocument();
      expect(screen.getByText('mild')).toBeInTheDocument();

      // Check reactions are displayed
      expect(screen.getByText('Anaphylaxis, difficulty breathing, hives')).toBeInTheDocument();
      expect(screen.getByText('Contact dermatitis, rash')).toBeInTheDocument();
    });

    test('shows status badges and onset dates', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Check status badges
      expect(screen.getAllByText('active')).toHaveLength(3);
      expect(screen.getByText('resolved')).toBeInTheDocument();

      // Check formatted onset dates
      expect(screen.getByText('May 15, 2020')).toBeInTheDocument();
      expect(screen.getByText('Mar 10, 2018')).toBeInTheDocument();
    });

    test('displays critical allergy warnings prominently', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Peanuts')).toBeInTheDocument();
      });

      // Life-threatening allergies should be visually prominent
      const peanutCard = screen.getByText('Peanuts').closest('.mantine-Card-root, .card');
      const lifeThreateningBadge = within(peanutCard || document.body).getByText('life-threatening');
      expect(lifeThreateningBadge).toBeInTheDocument();

      // EpiPen note should be visible
      expect(screen.getByText('Confirmed by allergist. Carry EpiPen at all times.')).toBeInTheDocument();
    });
  });

  describe('Allergy CRUD Operations', () => {
    test('creates a new allergy through complete workflow', async () => {
      
      const mockCreateItem = jest.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: mockCreateItem,
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Click Add New Allergy button
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Allergy')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Allergen *'), 'Ibuprofen');
      
      // Select severity
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Moderate - Moderate reaction'));

      // Select status
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Active - Currently active'));

      // Add reaction description
      await userEvent.type(screen.getByLabelText('Reaction'), 'Stomach irritation, nausea');

      // Set onset date
      const onsetDateInput = screen.getByTestId('date-onset-date');
      await userEvent.type(onsetDateInput, '2023-06-15');

      // Add notes
      await userEvent.type(screen.getByLabelText('Notes'), 'Avoid all NSAIDs. Use acetaminophen for pain relief.');

      // Submit form
      const submitButton = screen.getByText('Add Allergy');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        allergen: 'Ibuprofen',
        severity: 'moderate',
        reaction: 'Stomach irritation, nausea',
        onset_date: '2023-06-15',
        status: 'active',
        notes: 'Avoid all NSAIDs. Use acetaminophen for pain relief.',
        patient_id: 1,
      });
    });

    test('edits existing allergy with updated severity', async () => {
      
      const mockUpdateItem = jest.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: jest.fn(),
        updateItem: mockUpdateItem,
        deleteItem: jest.fn(),
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Latex')).toBeInTheDocument();
      });

      // Find and click edit button for Latex allergy
      const latexCard = screen.getByText('Latex').closest('.mantine-Card-root, .card');
      const editButton = within(latexCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Allergy')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Latex')).toBeInTheDocument();

      // Update severity to severe
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Severe - Severe reaction'));

      // Update reaction description
      const reactionField = screen.getByLabelText('Reaction');
      await userEvent.clear(reactionField);
      await userEvent.type(reactionField, 'Severe contact dermatitis, blistering, systemic reaction');

      // Submit changes
      const updateButton = screen.getByText('Update Allergy');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({
        severity: 'severe',
        reaction: 'Severe contact dermatitis, blistering, systemic reaction',
      }));
    });

    test('deletes allergy with confirmation', async () => {
      
      const mockDeleteItem = jest.fn().mockResolvedValue({});
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: jest.fn(),
        updateItem: jest.fn(),
        deleteItem: mockDeleteItem,
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
      });

      // Find and click delete button for resolved shellfish allergy
      const shellfishCard = screen.getByText('Shellfish').closest('.mantine-Card-root, .card');
      const deleteButton = within(shellfishCard || document.body).getByText('Delete');
      await userEvent.click(deleteButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(4);
    });
  });

  describe('Filtering and Search', () => {
    test('filters allergies by severity level', async () => {
      
      
      // Mock filtered data for severe allergies
      const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockAllergies.filter(a => a.severity === 'severe' || a.severity === 'life-threatening'),
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Apply severe+ filter
      const severityFilter = screen.getByLabelText('Severity');
      await userEvent.click(severityFilter);
      await userEvent.click(screen.getByText('Severe+'));

      // Should only show severe and life-threatening allergies
      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Peanuts')).toBeInTheDocument();
      expect(screen.queryByText('Latex')).not.toBeInTheDocument();
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument();
    });

    test('filters allergies by status', async () => {
      
      
      // Mock filtered data for active allergies
      const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockAllergies.filter(a => a.status === 'active'),
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Apply active filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Active'));

      // Should only show active allergies
      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Peanuts')).toBeInTheDocument();
      expect(screen.getByText('Latex')).toBeInTheDocument();
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument();
    });

    test('searches allergies by allergen name', async () => {
      
      
      // Mock filtered data for penicillin search
      const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockAllergies.filter(a => a.allergen.toLowerCase().includes('penicillin')),
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Search for penicillin
      const searchInput = screen.getByPlaceholderText('Search allergies...');
      await userEvent.type(searchInput, 'penicillin');

      // Should only show penicillin allergy
      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.queryByText('Peanuts')).not.toBeInTheDocument();
      expect(screen.queryByText('Latex')).not.toBeInTheDocument();
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument();
    });
  });

  describe('Allergy Details View', () => {
    test('opens detailed view modal with comprehensive information', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Click on allergy name to view details
      await userEvent.click(screen.getByText('Penicillin'));

      // Details modal should open
      expect(screen.getByText('Allergy Details')).toBeInTheDocument();
      expect(screen.getByText('Anaphylaxis, difficulty breathing, hives')).toBeInTheDocument();
      expect(screen.getByText('Confirmed by allergist. Carry EpiPen at all times.')).toBeInTheDocument();

      // Should show timeline information
      expect(screen.getByText('TIMELINE')).toBeInTheDocument();
      expect(screen.getByText('May 15, 2020')).toBeInTheDocument();
    });

    test('shows life-threatening allergy with proper warnings', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Peanuts')).toBeInTheDocument();
      });

      // Click view button for life-threatening peanut allergy
      const peanutCard = screen.getByText('Peanuts').closest('.mantine-Card-root, .card');
      const viewButton = within(peanutCard || document.body).getByText('View');
      await userEvent.click(viewButton);

      // Should show life-threatening severity prominently
      expect(screen.getByText('life-threatening')).toBeInTheDocument();
      expect(screen.getByText('Anaphylactic shock, swelling of throat')).toBeInTheDocument();
      expect(screen.getByText('Severe peanut allergy. Avoid all nuts and processed foods.')).toBeInTheDocument();
    });

    test('displays resolved allergy information', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
      });

      // Click on resolved shellfish allergy
      await userEvent.click(screen.getByText('Shellfish'));

      // Should show resolved status
      expect(screen.getByText('resolved')).toBeInTheDocument();
      expect(screen.getByText('Previously allergic, seems to have outgrown it.')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Initially in cards view
      expect(screen.getByText('Cards')).toBeInTheDocument();

      // Switch to table view
      const tableButton = screen.getByText('Table');
      await userEvent.click(tableButton);

      // Should now show table headers
      expect(screen.getByText('Allergen')).toBeInTheDocument();
      expect(screen.getByText('Reaction')).toBeInTheDocument();
      expect(screen.getByText('Severity')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Medical Safety Workflow', () => {
    test('handles emergency allergy documentation', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Create new life-threatening allergy
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Allergen *'), 'Bee Stings');
      
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Life-threatening - Anaphylaxis risk'));

      await userEvent.type(screen.getByLabelText('Reaction'), 'Anaphylactic shock, respiratory distress, cardiovascular collapse');

      const onsetDateInput = screen.getByTestId('date-onset-date');
      await userEvent.type(onsetDateInput, '2023-07-20');

      await userEvent.type(screen.getByLabelText('Notes'), 'EMERGENCY: Carry EpiPen. Avoid outdoor activities during bee season. Notify all healthcare providers.');

      const submitButton = screen.getByText('Add Allergy');
      await userEvent.click(submitButton);

      // Should create life-threatening allergy successfully
      expect(screen.getByText('Bee Stings')).toBeInTheDocument();
    });

    test('manages allergy resolution workflow', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Latex')).toBeInTheDocument();
      });

      // Edit latex allergy to resolved
      const latexCard = screen.getByText('Latex').closest('.mantine-Card-root, .card');
      const editButton = within(latexCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Change status to resolved
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Resolved - No longer allergic'));

      // Update notes
      const notesField = screen.getByLabelText('Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Allergy resolved after desensitization therapy. Can now use latex products without reaction.');

      const updateButton = screen.getByText('Update Allergy');
      await userEvent.click(updateButton);

      // Verify resolution
      expect(screen.getByText('resolved')).toBeInTheDocument();
    });

    test('validates drug allergy cross-reactions', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Create drug allergy with cross-reaction notes
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Allergen *'), 'Sulfonamides');
      await userEvent.type(screen.getByLabelText('Reaction'), 'Stevens-Johnson syndrome, severe skin reactions');
      await userEvent.type(screen.getByLabelText('Notes'), 'Cross-reactivity with sulfamethoxazole, furosemide, and some diabetes medications. Avoid all sulfa-containing drugs.');

      const submitButton = screen.getByText('Add Allergy');
      await userEvent.click(submitButton);

      // Should capture cross-reaction information
      expect(screen.getByText('Cross-reactivity with sulfamethoxazole, furosemide, and some diabetes medications.')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      
      const mockCreateItem = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: mockCreateItem,
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Try to create allergy
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Allergen *'), 'Test Allergen');
      
      const submitButton = screen.getByText('Add Allergy');
      await userEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create allergy')).toBeInTheDocument();
      });
    });

    test('handles allergies without detailed information', () => {
      const minimalAllergies = [
        {
          id: 1,
          allergen: 'Unknown Food Allergy',
          severity: null,
          reaction: null,
          onset_date: null,
          status: 'active',
          notes: null,
          patient_id: 1,
        },
      ];

      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;
      
      useMedicalData.mockReturnValue({
        items: minimalAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: jest.fn(),
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: minimalAllergies,
      });

      renderWithPatient(<Allergies />);

      // Should still render without errors
      expect(screen.getByText('Allergies')).toBeInTheDocument();
      expect(screen.getByText('Unknown Food Allergy')).toBeInTheDocument();
    });

    test('displays empty state when no allergies exist', () => {
      const useMedicalData = require('../../../hooks/useMedicalData').useMedicalData;
      const useDataManagement = require('../../../hooks/useDataManagement').useDataManagement;
      
      useMedicalData.mockReturnValue({
        items: [],
        currentPatient: { id: 1 },
        loading: false,
        error: null,
        successMessage: null,
        createItem: jest.fn(),
        updateItem: jest.fn(),
        deleteItem: jest.fn(),
        refreshData: jest.fn(),
        clearError: jest.fn(),
        setError: jest.fn(),
      });

      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: [],
        totalCount: 0,
        filteredCount: 0,
      });

      renderWithPatient(<Allergies />);

      expect(screen.getByText('No allergies found')).toBeInTheDocument();
      expect(screen.getByText('Click "Add New Allergy" to get started.')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates required allergen field', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      // Try to submit without allergen
      const submitButton = screen.getByText('Add Allergy');
      await userEvent.click(submitButton);

      // Should show validation error
      expect(screen.getByText('Allergen is required')).toBeInTheDocument();
    });

    test('validates severity levels for consistency', async () => {
      
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add New Allergy');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Allergen *'), 'Test Allergen');
      
      // Set life-threatening severity with mild reaction
      await userEvent.click(screen.getByLabelText('Severity'));
      await userEvent.click(screen.getByText('Life-threatening - Anaphylaxis risk'));

      await userEvent.type(screen.getByLabelText('Reaction'), 'Mild rash');

      // Should show validation warning
      expect(screen.getByText('Reaction severity may not match selected severity level')).toBeInTheDocument();
    });
  });
});