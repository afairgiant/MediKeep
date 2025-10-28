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
import LabResults from '../LabResults';
import { useMedicalData } from '../../../hooks/useMedicalData';
import { useDataManagement } from '../../../hooks/useDataManagement';
import { usePractitioners } from '../../../hooks/useGlobalData';

// Mock the hooks that make API calls
vi.mock('../../../hooks/useMedicalData');
vi.mock('../../../hooks/useGlobalData');
vi.mock('../../../hooks/useDataManagement');

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

describe('Lab Results Page Integration Tests', () => {
  const mockLabResults = [
    {
      id: 1,
      test_name: 'Complete Blood Count (CBC)',
      test_code: 'CBC',
      test_category: 'Hematology',
      test_type: 'Blood Test',
      facility: 'Quest Diagnostics',
      status: 'completed',
      labs_result: 'WBC: 6.8 K/uL (Normal)\nRBC: 4.5 M/uL (Normal)\nHgb: 14.2 g/dL (Normal)\nHct: 42.1% (Normal)',
      ordered_date: '2024-01-15',
      completed_date: '2024-01-16',
      notes: 'All values within normal range',
      practitioner_id: 1,
      patient_id: 1,
    },
    {
      id: 2,
      test_name: 'Lipid Panel',
      test_code: 'LIPID',
      test_category: 'Chemistry',
      test_type: 'Blood Test',
      facility: 'LabCorp',
      status: 'completed',
      labs_result: 'Total Cholesterol: 195 mg/dL (Normal)\nLDL: 115 mg/dL (Borderline High)\nHDL: 55 mg/dL (Normal)\nTriglycerides: 125 mg/dL (Normal)',
      ordered_date: '2024-01-10',
      completed_date: '2024-01-11',
      notes: 'LDL slightly elevated, recommend diet modification',
      practitioner_id: 2,
      patient_id: 1,
    },
    {
      id: 3,
      test_name: 'Thyroid Function Tests',
      test_code: 'TSH',
      test_category: 'Endocrinology',
      test_type: 'Blood Test',
      facility: 'Hospital Lab',
      status: 'pending',
      labs_result: '',
      ordered_date: '2024-01-20',
      completed_date: null,
      notes: 'Follow-up for thyroid symptoms',
      practitioner_id: 1,
      patient_id: 1,
    },
  ];

  const mockPractitioners = [
    { id: 1, name: 'Dr. Anderson', specialty: 'Internal Medicine' },
    { id: 2, name: 'Dr. Miller', specialty: 'Cardiology' },
  ];

  const mockFiles = [
    {
      id: 1,
      filename: 'cbc_results.pdf',
      description: 'CBC Lab Report',
      file_size: 45231,
      created_at: '2024-01-16T10:30:00Z',
    },
    {
      id: 2,
      filename: 'lipid_panel.pdf',
      description: 'Lipid Panel Results',
      file_size: 38912,
      created_at: '2024-01-11T14:15:00Z',
    },
  ];

  // Mock data management hook
  const mockDataManagement = {
    data: mockLabResults,
    filters: {
      search: '',
      status: '',
      category: '',
      dateRange: '',
    },
    updateFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    statusOptions: [
      { value: 'ordered', label: 'Ordered' },
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    categoryOptions: [
      { value: 'hematology', label: 'Hematology' },
      { value: 'chemistry', label: 'Chemistry' },
      { value: 'endocrinology', label: 'Endocrinology' },
    ],
    dateRangeOptions: [],
    sortOptions: [],
    sortBy: 'ordered_date',
    sortOrder: 'desc',
    handleSortChange: vi.fn(),
    totalCount: mockLabResults.length,
    filteredCount: mockLabResults.length,
  };

  beforeEach(() => {
    // Mock the hooks to return our test data




    vi.mocked(useMedicalData).mockReturnValue({
      items: mockLabResults,
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

    vi.mocked(usePractitioners).mockReturnValue({
      practitioners: mockPractitioners,
      loading: false,
    });

    useDataManagement.mockReturnValue(mockDataManagement);

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/lab-results', (req, res, ctx) => {
        return res(ctx.json(mockLabResults));
      }),
      rest.post('/api/v1/lab-results', (req, res, ctx) => {
        const newLabResult = { id: 4, ...req.body };
        return res(ctx.json(newLabResult));
      }),
      rest.put('/api/v1/lab-results/:id', (req, res, ctx) => {
        const updatedLabResult = { ...mockLabResults[0], ...req.body };
        return res(ctx.json(updatedLabResult));
      }),
      rest.delete('/api/v1/lab-results/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      }),
      rest.get('/api/v1/lab-results/:id/files', (req, res, ctx) => {
        return res(ctx.json(mockFiles));
      }),
      rest.post('/api/v1/lab-results/:id/files', (req, res, ctx) => {
        return res(ctx.json({ message: 'File uploaded successfully' }));
      }),
      rest.delete('/api/v1/lab-result-files/:fileId', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders lab results page with initial data', async () => {
      renderWithPatient(<LabResults />);

      // Check page header
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
      
      // Check that lab results are displayed
      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
        expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });
    });

    test('displays lab result details with categories and statuses', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Check test categories are displayed
      expect(screen.getByText('Hematology')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.getByText('Endocrinology')).toBeInTheDocument();

      // Check status badges
      expect(screen.getAllByText('completed')).toHaveLength(2);
      expect(screen.getByText('pending')).toBeInTheDocument();

      // Check test codes
      expect(screen.getByText('CBC')).toBeInTheDocument();
      expect(screen.getByText('LIPID')).toBeInTheDocument();
      expect(screen.getByText('TSH')).toBeInTheDocument();
    });

    test('shows ordered and completed dates', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Check formatted dates
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument(); // Ordered date
      expect(screen.getByText('Jan 16, 2024')).toBeInTheDocument(); // Completed date
      expect(screen.getByText('Jan 20, 2024')).toBeInTheDocument(); // Pending test ordered date
    });

    test('displays facilities and practitioners', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Quest Diagnostics')).toBeInTheDocument();
      });

      // Check facilities
      expect(screen.getByText('LabCorp')).toBeInTheDocument();
      expect(screen.getByText('Hospital Lab')).toBeInTheDocument();

      // Check practitioners
      expect(screen.getByText('Dr. Anderson')).toBeInTheDocument();
      expect(screen.getByText('Dr. Miller')).toBeInTheDocument();
    });
  });

  describe('Lab Result CRUD Operations', () => {
    test('creates a new lab result through complete workflow', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({});
      
  
      vi.mocked(useMedicalData).mockReturnValue({
        items: mockLabResults,
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

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Click Add Lab Result button
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Lab Result')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Test Name *'), 'Glucose Tolerance Test');
      await userEvent.type(screen.getByLabelText('Test Code'), 'GTT');
      
      // Select category
      await userEvent.click(screen.getByLabelText('Test Category'));
      await userEvent.click(screen.getByText('Endocrinology - Hormone tests'));

      // Select type
      await userEvent.click(screen.getByLabelText('Test Type'));
      await userEvent.click(screen.getByText('Blood Test - Blood sample'));

      await userEvent.type(screen.getByLabelText('Facility'), 'Diabetes Center Lab');

      // Select status
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Ordered - Test has been ordered'));

      // Set ordered date
      const orderedDateInput = screen.getByTestId('date-ordered-date');
      await userEvent.type(orderedDateInput, '2024-02-01');

      // Select practitioner
      await userEvent.click(screen.getByLabelText('Ordering Practitioner'));
      await userEvent.click(screen.getByText('Dr. Anderson - Internal Medicine'));

      // Add notes
      await userEvent.type(screen.getByLabelText('Notes'), 'Pre-diabetes screening as requested');

      // Submit form
      const submitButton = screen.getByText('Add Lab Result');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        test_name: 'Glucose Tolerance Test',
        test_code: 'GTT',
        test_category: 'endocrinology',
        test_type: 'blood_test',
        facility: 'Diabetes Center Lab',
        status: 'ordered',
        labs_result: '',
        ordered_date: '2024-02-01',
        completed_date: '',
        notes: 'Pre-diabetes screening as requested',
        practitioner_id: '1',
        patient_id: 1,
      });
    });

    test('edits existing lab result with results and completion date', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
  
      vi.mocked(useMedicalData).mockReturnValue({
        items: mockLabResults,
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

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });

      // Find and click edit button for pending thyroid test
      const thyroidCard = screen.getByText('Thyroid Function Tests').closest('.mantine-Card-root, .card');
      const editButton = within(thyroidCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Lab Result')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Thyroid Function Tests')).toBeInTheDocument();

      // Update status to completed
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Completed - Test has been completed'));

      // Set completion date
      const completedDateInput = screen.getByTestId('date-completed-date');
      await userEvent.type(completedDateInput, '2024-01-22');

      // Add lab results
      const resultsField = screen.getByLabelText('Lab Results');
      await userEvent.type(resultsField, 'TSH: 2.1 mIU/L (Normal)\nFree T4: 1.3 ng/dL (Normal)\nFree T3: 3.2 pg/mL (Normal)');

      // Update notes
      const notesField = screen.getByLabelText('Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Thyroid function within normal limits. No further action needed.');

      // Submit changes
      const updateButton = screen.getByText('Update Lab Result');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({
        status: 'completed',
        completed_date: '2024-01-22',
        labs_result: 'TSH: 2.1 mIU/L (Normal)\nFree T4: 1.3 ng/dL (Normal)\nFree T3: 3.2 pg/mL (Normal)',
        notes: 'Thyroid function within normal limits. No further action needed.',
      }));
    });

    test('deletes lab result with confirmation', async () => {
      
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      
  
      vi.mocked(useMedicalData).mockReturnValue({
        items: mockLabResults,
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

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Find and click delete button
      const cbcCard = screen.getByText('Complete Blood Count (CBC)').closest('.mantine-Card-root, .card');
      const deleteButton = within(cbcCard || document.body).getByText('Delete');
      await userEvent.click(deleteButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('File Management Integration', () => {
    test('uploads files with lab result creation', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({ id: 4 });
      
      // Mock file upload API
      const mockUploadFile = vi.fn().mockResolvedValue({});
      server.use(
        rest.post('/api/v1/lab-results/:id/files', (req, res, ctx) => {
          mockUploadFile();
          return res(ctx.json({ message: 'File uploaded successfully' }));
        })
      );

  
      vi.mocked(useMedicalData).mockReturnValue({
        items: mockLabResults,
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

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      // Fill basic fields
      await userEvent.type(screen.getByLabelText('Test Name *'), 'X-Ray Chest');

      // Mock file upload
      const file = new File(['test file content'], 'xray_results.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText('Attach Files');
      await userEvent.upload(fileInput, file);

      // Add file description
      await userEvent.type(screen.getByLabelText('File Description'), 'Chest X-ray PA and lateral views');

      const submitButton = screen.getByText('Add Lab Result');
      await userEvent.click(submitButton);

      // Should create lab result and upload file
      expect(mockCreateItem).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled();
      });
    });

    test('views lab result with attached files', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Click view button
      const cbcCard = screen.getByText('Complete Blood Count (CBC)').closest('.mantine-Card-root, .card');
      const viewButton = within(cbcCard || document.body).getByText('View');
      await userEvent.click(viewButton);

      // Should show lab result details modal
      expect(screen.getByText('Lab Result Details')).toBeInTheDocument();
      expect(screen.getByText('WBC: 6.8 K/uL (Normal)')).toBeInTheDocument();

      // Should show attached files
      await waitFor(() => {
        expect(screen.getByText('cbc_results.pdf')).toBeInTheDocument();
        expect(screen.getByText('CBC Lab Report')).toBeInTheDocument();
      });
    });

    test('downloads attached files', async () => {
      
      
      // Mock download API
      const mockDownload = vi.fn();
      global.URL.createObjectURL = vi.fn();
      global.document.createElement = vi.fn(() => ({
        href: '',
        download: '',
        click: mockDownload,
      }));

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Open details view
      const cbcCard = screen.getByText('Complete Blood Count (CBC)').closest('.mantine-Card-root, .card');
      const viewButton = within(cbcCard || document.body).getByText('View');
      await userEvent.click(viewButton);

      // Click download button for file
      await waitFor(() => {
        const downloadButton = screen.getByLabelText('Download cbc_results.pdf');
        userEvent.click(downloadButton);
      });

      // Should trigger download
      expect(mockDownload).toHaveBeenCalled();
    });
  });

  describe('Filtering and Search', () => {
    test('filters lab results by status', async () => {
      
      
      // Mock filtered data for completed results
  
      vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.status === 'completed'),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Apply completed filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Completed'));

      // Should only show completed results
      expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });

    test('filters lab results by category', async () => {
      
      
      // Mock filtered data for hematology
  
      vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.test_category === 'Hematology'),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Apply hematology filter
      const categoryFilter = screen.getByLabelText('Category');
      await userEvent.click(categoryFilter);
      await userEvent.click(screen.getByText('Hematology'));

      // Should only show hematology tests
      expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      expect(screen.queryByText('Lipid Panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });

    test('searches lab results by test name', async () => {
      
      
      // Mock filtered data for lipid search
  
      vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.test_name.toLowerCase().includes('lipid')),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      });

      // Search for lipid
      const searchInput = screen.getByPlaceholderText('Search lab results...');
      await userEvent.type(searchInput, 'lipid');

      // Should only show lipid panel
      expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      expect(screen.queryByText('Complete Blood Count (CBC)')).not.toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      // Initially in cards view
      expect(screen.getByText('Cards')).toBeInTheDocument();

      // Switch to table view
      const tableButton = screen.getByText('Table');
      await userEvent.click(tableButton);

      // Should now show table headers
      expect(screen.getByText('Test Name')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Ordered Date')).toBeInTheDocument();
    });
  });

  describe('Clinical Workflow Integration', () => {
    test('tracks lab result lifecycle from ordered to completed', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });

      // Pending test should show ordered status
      expect(screen.getByText('pending')).toBeInTheDocument();

      // Edit to mark as completed
      const thyroidCard = screen.getByText('Thyroid Function Tests').closest('.mantine-Card-root, .card');
      const editButton = within(thyroidCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Change to completed status
      await userEvent.click(screen.getByLabelText('Status'));
      await userEvent.click(screen.getByText('Completed - Test has been completed'));

      // Should now show completion workflow
      expect(screen.getByTestId('date-completed-date')).toBeInTheDocument();
      expect(screen.getByLabelText('Lab Results')).toBeInTheDocument();
    });

    test('handles abnormal results with appropriate flagging', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      });

      // View lipid panel with borderline high LDL
      const lipidCard = screen.getByText('Lipid Panel').closest('.mantine-Card-root, .card');
      const viewButton = within(lipidCard || document.body).getByText('View');
      await userEvent.click(viewButton);

      // Should show abnormal result
      expect(screen.getByText('LDL: 115 mg/dL (Borderline High)')).toBeInTheDocument();
      expect(screen.getByText('LDL slightly elevated, recommend diet modification')).toBeInTheDocument();
    });

    test('manages follow-up recommendations', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Create follow-up lab order
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Test Name *'), 'HbA1c Follow-up');
      await userEvent.type(screen.getByLabelText('Notes'), 'Follow-up HbA1c in 3 months per diabetes management plan. Target <7%.');

      const submitButton = screen.getByText('Add Lab Result');
      await userEvent.click(submitButton);

      // Should capture follow-up context
      expect(screen.getByText('Follow-up HbA1c in 3 months per diabetes management plan.')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      
      const mockCreateItem = vi.fn().mockRejectedValue(new Error('Network error'));
      
  
      vi.mocked(useMedicalData).mockReturnValue({
        items: mockLabResults,
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

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Try to create lab result
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Test Name *'), 'Test Lab');
      
      const submitButton = screen.getByText('Add Lab Result');
      await userEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create lab result')).toBeInTheDocument();
      });
    });

    test('handles missing file attachments gracefully', () => {
      // Mock lab result without files
      server.use(
        rest.get('/api/v1/lab-results/:id/files', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      renderWithPatient(<LabResults />);

      // Should still render without errors
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
      expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    });

    test('displays empty state when no lab results exist', () => {
  
  
      
      vi.mocked(useMedicalData).mockReturnValue({
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

      vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: [],
        totalCount: 0,
        filteredCount: 0,
      });

      renderWithPatient(<LabResults />);

      expect(screen.getByText('No lab results found')).toBeInTheDocument();
      expect(screen.getByText('Start by adding your first lab result.')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates required test name field', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      // Try to submit without test name
      const submitButton = screen.getByText('Add Lab Result');
      await userEvent.click(submitButton);

      // Should show validation error
      expect(screen.getByText('Test name is required')).toBeInTheDocument();
    });

    test('validates date consistency', async () => {
      
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Lab Result');
      await userEvent.click(addButton);

      // Set completion date before ordered date
      const orderedDateInput = screen.getByTestId('date-ordered-date');
      const completedDateInput = screen.getByTestId('date-completed-date');
      
      await userEvent.type(orderedDateInput, '2024-02-01');
      await userEvent.type(completedDateInput, '2024-01-31');

      // Should show validation error
      expect(screen.getByText('Completed date cannot be before ordered date')).toBeInTheDocument();
    });
  });
});
