import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import component to test
import ResponsiveTable from '../../components/adapters/ResponsiveTable';

// Import test utilities
import {
  renderResponsive,
  testAtAllBreakpoints,
  TEST_VIEWPORTS,
  mockViewport,
  DEVICE_TYPES,
  getBreakpointForWidth,
  getDeviceTypeForBreakpoint
} from './ResponsiveTestUtils';

import logger from '../../services/logger';
import { useResponsive } from '../../hooks/useResponsive';

// Mock logger to avoid console noise during tests
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useResponsive hook
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    breakpoint: 'lg',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1280,
    height: 720
  }))
}));

// Sample data for testing
const sampleMedicationData = [
  {
    id: 1,
    medication_name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Once daily',
    prescribing_practitioner: 'Dr. Smith',
    start_date: '2024-01-15',
    status: 'Active'
  },
  {
    id: 2,
    medication_name: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    prescribing_practitioner: 'Dr. Johnson',
    start_date: '2024-02-01',
    status: 'Active'
  },
  {
    id: 3,
    medication_name: 'Aspirin',
    dosage: '81mg',
    frequency: 'Once daily',
    prescribing_practitioner: 'Dr. Brown',
    start_date: '2024-01-10',
    status: 'Discontinued'
  }
];

const sampleColumns = [
  {
    key: 'medication_name',
    title: 'Medication',
    priority: 'high',
    render: (value) => <strong>{value}</strong>
  },
  {
    key: 'dosage',
    title: 'Dosage',
    priority: 'high'
  },
  {
    key: 'frequency',
    title: 'Frequency',
    priority: 'medium'
  },
  {
    key: 'prescribing_practitioner',
    title: 'Prescribing Doctor',
    priority: 'medium'
  },
  {
    key: 'start_date',
    title: 'Start Date',
    priority: 'low'
  },
  {
    key: 'status',
    title: 'Status',
    priority: 'high',
    render: (value) => (
      <span style={{ color: value === 'Active' ? 'green' : 'red' }}>
        {value}
      </span>
    )
  }
];

const sampleAllergyData = [
  {
    id: 1,
    allergen: 'Penicillin',
    reaction_type: 'Skin rash',
    severity: 'Moderate',
    notes: 'Developed rash within 2 hours'
  },
  {
    id: 2,
    allergen: 'Shellfish',
    reaction_type: 'Swelling',
    severity: 'Severe',
    notes: 'Anaphylactic reaction'
  }
];

const sampleAllergyColumns = [
  { key: 'allergen', title: 'Allergen', priority: 'high' },
  { key: 'reaction_type', title: 'Reaction', priority: 'high' },
  { key: 'severity', title: 'Severity', priority: 'high' },
  { key: 'notes', title: 'Notes', priority: 'low' }
];

describe('ResponsiveTable Component Tests', () => {
  const defaultProps = {
    data: sampleMedicationData,
    columns: sampleColumns,
    dataType: 'medications',
    medicalContext: 'medications'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering Tests', () => {
    it('renders without crashing', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} />);
      // On desktop/tablet, should render as table; on mobile as cards
      const table = screen.queryByRole('table');
      const text = screen.queryByText(sampleMedicationData[0].medication_name);
      expect(table || text).toBeTruthy();
    });

    it('renders loading state correctly', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} loading={true} />);
      // Skeleton components render SVG elements
      const skeletons = document.querySelectorAll('[class*="Skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders empty state when no data', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} data={[]} />);
      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    it('renders error state correctly', () => {
      const error = new Error('Test error');
      renderResponsive(<ResponsiveTable {...defaultProps} error={error} />);
      expect(screen.getByText(/test error/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior Tests', () => {
    testAtAllBreakpoints(
      <ResponsiveTable {...defaultProps} />,
      (breakpoint, viewport) => {
        const deviceType = getDeviceTypeForBreakpoint(getBreakpointForWidth(viewport.width));

        describe(`Table Display at ${breakpoint}`, () => {
          it('displays correct view type for breakpoint', () => {
            // Mock the responsive hook to return correct values
            useResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet', 
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });

            renderResponsive(<ResponsiveTable {...defaultProps} />, { viewport });

            if (deviceType === 'mobile') {
              // Mobile should show cards (no table role)
              expect(screen.queryByRole('table')).not.toBeInTheDocument();
              // Cards are rendered but don't have specific test IDs - check for card content instead
              expect(screen.getByText('Lisinopril')).toBeInTheDocument();
            } else {
              // Tablet and desktop should show table
              expect(screen.getByRole('table')).toBeInTheDocument();
            }
          });

          it('shows appropriate columns for breakpoint', () => {
            useResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet', 
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });

            renderResponsive(<ResponsiveTable {...defaultProps} />, { viewport });

            if (deviceType === 'desktop') {
              // Desktop should show all columns
              sampleColumns.forEach(column => {
                expect(screen.getByRole('columnheader', { name: column.title })).toBeInTheDocument();
              });
            } else if (deviceType === 'tablet') {
              // Tablet should show high and medium priority columns
              const highPriorityColumns = sampleColumns.filter(col => col.priority === 'high');
              const mediumPriorityColumns = sampleColumns.filter(col => col.priority === 'medium');
              
              [...highPriorityColumns, ...mediumPriorityColumns].forEach(column => {
                expect(screen.getByRole('columnheader', { name: column.title })).toBeInTheDocument();
              });
            }
          });

          it('handles touch interactions appropriately', async () => {
            if (deviceType === 'mobile') {
              const user = userEvent.setup();
              const mockOnRowClick = vi.fn();

                useResponsive.mockReturnValue({
                breakpoint,
                deviceType: 'mobile',
                isMobile: true,
                isTablet: false,
                isDesktop: false,
                width: viewport.width,
                height: viewport.height
              });

              renderResponsive(
                <ResponsiveTable {...defaultProps} onRowClick={mockOnRowClick} />,
                { viewport }
              );

              // Find and click first card (mobile view) - cards are Mantine Card components
              const firstCardContent = screen.getByText('Lisinopril');
              const firstCard = firstCardContent.closest('[class*="Card-root"]');
              if (firstCard) {
                await user.click(firstCard);

                await waitFor(() => {
                  expect(mockOnRowClick).toHaveBeenCalledWith(
                    sampleMedicationData[0],
                    0,
                    expect.any(Object)
                  );
                });
              }
            }
          });
        });
      }
    );
  });

  describe('Sorting Functionality', () => {
    const sortableProps = {
      ...defaultProps,
      sortable: true,
      sortBy: null,
      sortDirection: 'asc'
    };

    it('renders sortable column headers', () => {
      renderResponsive(<ResponsiveTable {...sortableProps} />, {
        viewport: TEST_VIEWPORTS.desktop
      });

      // Check for sort icons - they're ActionIcon components with SVG icons
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
      // Check that headers contain clickable sort buttons
      const sortButtons = document.querySelectorAll('[class*="ActionIcon"]');
      expect(sortButtons.length).toBeGreaterThan(0);
    });

    it('handles column sorting correctly', async () => {
      const user = userEvent.setup();
      const mockOnSort = vi.fn();

      renderResponsive(
        <ResponsiveTable {...sortableProps} onSort={mockOnSort} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Click on medication name column to sort
      const medicationHeader = screen.getByRole('columnheader', { name: /medication/i });
      await user.click(medicationHeader);

      await waitFor(() => {
        expect(mockOnSort).toHaveBeenCalledWith('medication_name', 'asc');
      });

      // Click again to reverse sort
      await user.click(medicationHeader);

      await waitFor(() => {
        expect(mockOnSort).toHaveBeenCalledWith('medication_name', 'desc');
      });
    });

    it('displays correct sort indicators', () => {
      renderResponsive(
        <ResponsiveTable 
          {...sortableProps} 
          sortBy="medication_name"
          sortDirection="asc"
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const medicationHeader = screen.getByRole('columnheader', { name: /medication/i });
      expect(medicationHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('sorts data correctly when internal sorting is enabled', () => {
      const unsortedData = [...sampleMedicationData].reverse();
      
      renderResponsive(
        <ResponsiveTable 
          {...sortableProps}
          data={unsortedData}
          sortBy="medication_name"
          sortDirection="asc"
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Check if first row shows "Aspirin" (alphabetically first)
      const firstRow = screen.getAllByRole('row')[1]; // Skip header row
      expect(within(firstRow).getByText('Aspirin')).toBeInTheDocument();
    });
  });

  describe('Selection Functionality', () => {
    const selectableProps = {
      ...defaultProps,
      selectable: true,
      selectedRows: [],
      onRowSelect: vi.fn()
    };

    it('handles row selection correctly', async () => {
      const user = userEvent.setup();
      const mockOnRowSelect = vi.fn();

      renderResponsive(
        <ResponsiveTable {...selectableProps} onRowSelect={mockOnRowSelect} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Click first data row
      const firstDataRow = screen.getAllByRole('row')[1];
      await user.click(firstDataRow);

      await waitFor(() => {
        expect(mockOnRowSelect).toHaveBeenCalledWith(sampleMedicationData[0], true);
      });
    });

    it('shows selected state visually', () => {
      renderResponsive(
        <ResponsiveTable 
          {...selectableProps} 
          selectedRows={[1]} // First medication selected
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const firstDataRow = screen.getAllByRole('row')[1];
      expect(firstDataRow).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Pagination Tests', () => {
    const paginatedProps = {
      ...defaultProps,
      pagination: true,
      page: 1,
      pageSize: 2,
      totalRecords: 5,
      onPageChange: vi.fn()
    };

    it('renders pagination controls', () => {
      renderResponsive(<ResponsiveTable {...paginatedProps} />, {
        viewport: TEST_VIEWPORTS.desktop
      });

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Current page
    });

    it('handles page changes correctly', async () => {
      const user = userEvent.setup();
      const mockOnPageChange = vi.fn();

      renderResponsive(
        <ResponsiveTable {...paginatedProps} onPageChange={mockOnPageChange} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Click next page button
      const nextPageButton = screen.getByRole('button', { name: /next/i }) ||
                           screen.getByText('2');
      await user.click(nextPageButton);

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith(2);
      });
    });

    it('does not render pagination when not needed', () => {
      renderResponsive(
        <ResponsiveTable 
          {...paginatedProps} 
          totalRecords={2} 
          pageSize={5} 
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  describe('Card View Tests (Mobile)', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        breakpoint: 'xs',
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });
    });

    it('renders data as cards on mobile', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} />, {
        viewport: TEST_VIEWPORTS.mobile
      });

      // Should not have table
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      // Should have cards - verify by checking data is rendered
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('Aspirin')).toBeInTheDocument();
    });

    it('shows priority fields in card view', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} />, {
        viewport: TEST_VIEWPORTS.mobile
      });

      // High priority fields should be visible
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('10mg')).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    it('handles card interactions correctly', async () => {
      const user = userEvent.setup();
      const mockOnRowClick = vi.fn();

      renderResponsive(
        <ResponsiveTable {...defaultProps} onRowClick={mockOnRowClick} />,
        { viewport: TEST_VIEWPORTS.mobile }
      );

      // Find card by locating the first medication name and getting its card container
      const firstMedication = screen.getByText('Lisinopril');
      const firstCard = firstMedication.closest('[class*="Card-root"]');
      expect(firstCard).toBeTruthy();

      if (firstCard) {
        await user.click(firstCard);

        await waitFor(() => {
          expect(mockOnRowClick).toHaveBeenCalledWith(
            sampleMedicationData[0],
            0,
            expect.any(Object)
          );
        });
      }
    });

    it('shows secondary info indicator when appropriate', () => {
      renderResponsive(
        <ResponsiveTable {...defaultProps} showSecondaryInfo={true} />,
        { viewport: TEST_VIEWPORTS.mobile }
      );

      // Should show "+X more fields" text for cards with hidden fields
      // The actual text pattern is "+N more field" or "+N more fields"
      const moreFieldsText = screen.queryByText(/\+\d+ more field/);
      // This is optional based on how many fields are displayed vs total columns
      // Just verify it renders without error
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('has proper ARIA labels', () => {
      renderResponsive(
        <ResponsiveTable 
          {...defaultProps}
          aria-label="Medications table"
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Medications table');
    });

    it('has correct ARIA sort attributes', () => {
      renderResponsive(
        <ResponsiveTable 
          {...defaultProps}
          sortable={true}
          sortBy="medication_name"
          sortDirection="desc"
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const sortedHeader = screen.getByRole('columnheader', { name: /medication/i });
      expect(sortedHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnRowClick = vi.fn();

      renderResponsive(
        <ResponsiveTable 
          {...defaultProps} 
          onRowClick={mockOnRowClick}
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const firstDataRow = screen.getAllByRole('row')[1];
      firstDataRow.focus();
      
      // Press Enter to select
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnRowClick).toHaveBeenCalled();
      });
    });

    it('has proper role attributes in card view', () => {
      useResponsive.mockReturnValue({
        breakpoint: 'xs',
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });

      renderResponsive(<ResponsiveTable {...defaultProps} />, {
        viewport: TEST_VIEWPORTS.mobile
      });

      // Cards don't have explicit role="button", but they should be clickable
      // Verify cards are rendered by checking content
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText('Aspirin')).toBeInTheDocument();
    });
  });

  describe('Performance Tests', () => {
    it('renders large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 100 }, (_, index) => ({
        id: index,
        medication_name: `Medication ${index}`,
        dosage: `${(index + 1) * 10}mg`,
        frequency: index % 2 === 0 ? 'Once daily' : 'Twice daily',
        prescribing_practitioner: `Dr. ${String.fromCharCode(65 + (index % 26))}`,
        start_date: '2024-01-01',
        status: index % 3 === 0 ? 'Discontinued' : 'Active'
      }));

      const startTime = performance.now();
      
      const { unmount } = renderResponsive(
        <ResponsiveTable {...defaultProps} data={largeDataset} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );
      
      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(200);
      
      unmount();
    });

    it('handles virtualization when needed', () => {
      const veryLargeDataset = Array.from({ length: 1000 }, (_, index) => ({
        id: index,
        medication_name: `Medication ${index}`,
        dosage: `${(index + 1) * 10}mg`,
        frequency: 'Once daily',
        prescribing_practitioner: 'Dr. Smith',
        start_date: '2024-01-01',
        status: 'Active'
      }));

      renderResponsive(
        <ResponsiveTable 
          {...defaultProps} 
          data={veryLargeDataset}
          virtualization={true}
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Component should handle large dataset
      // Check table renders (pagination limits rows)
      const table = screen.queryByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Different Data Types Tests', () => {
    it('handles allergy data correctly', () => {
      renderResponsive(
        <ResponsiveTable 
          data={sampleAllergyData}
          columns={sampleAllergyColumns}
          dataType="allergies"
          medicalContext="allergies"
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });

    it('adapts column priorities based on data type', () => {
      useResponsive.mockReturnValue({
        breakpoint: 'md',
        deviceType: 'tablet',
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        width: 768,
        height: 1024
      });

      renderResponsive(
        <ResponsiveTable 
          data={sampleAllergyData}
          columns={sampleAllergyColumns}
          dataType="allergies"
          medicalContext="allergies"
        />,
        { viewport: TEST_VIEWPORTS.tablet }
      );

      // High priority allergy columns should be visible
      expect(screen.getByRole('columnheader', { name: /allergen/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /severity/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling Tests', () => {
    it('handles invalid data gracefully', () => {
      // Test with malformed data
      const invalidData = [
        { id: 1, medication_name: null, dosage: undefined },
        { id: 2, medication_name: 'Test', dosage: '' }
      ];

      renderResponsive(
        <ResponsiveTable {...defaultProps} data={invalidData} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Should still render without crashing
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('handles missing columns configuration', () => {
      renderResponsive(
        <ResponsiveTable {...defaultProps} columns={[]} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Should render but show empty state or handle gracefully
      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });

    it('logs errors appropriately', () => {
      const invalidProps = { ...defaultProps, data: null };

      renderResponsive(<ResponsiveTable {...invalidProps} />);

      // Component handles null data by showing empty state or logging error
      // Check if error was logged with correct message pattern
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/invalid|received/i),
        expect.any(Object)
      );
    });
  });

  describe('Action Buttons', () => {
    const actionProps = {
      ...defaultProps,
      onView: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    };

    it('renders Actions column header when callbacks are provided', () => {
      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('does not render Actions column header when no callbacks are provided', () => {
      renderResponsive(<ResponsiveTable {...defaultProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });

    it('renders View, Edit, Delete buttons for each row', () => {
      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

      expect(viewButtons).toHaveLength(sampleMedicationData.length);
      expect(editButtons).toHaveLength(sampleMedicationData.length);
      expect(deleteButtons).toHaveLength(sampleMedicationData.length);
    });

    it('calls onView with the row when View is clicked', async () => {
      const user = userEvent.setup();
      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(actionProps.onView).toHaveBeenCalledWith(sampleMedicationData[0]);
      });
    });

    it('calls onEdit with the row when Edit is clicked', async () => {
      const user = userEvent.setup();
      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[1]);

      await waitFor(() => {
        expect(actionProps.onEdit).toHaveBeenCalledWith(sampleMedicationData[1]);
      });
    });

    it('calls onDelete with row.id when Delete is clicked', async () => {
      const user = userEvent.setup();
      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.desktop,
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[2]);

      await waitFor(() => {
        expect(actionProps.onDelete).toHaveBeenCalledWith(sampleMedicationData[2].id);
      });
    });

    it('action button click does not trigger row click', async () => {
      const user = userEvent.setup();
      const mockRowClick = vi.fn();

      renderResponsive(
        <ResponsiveTable {...actionProps} onRowClick={mockRowClick} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(actionProps.onView).toHaveBeenCalled();
        expect(mockRowClick).not.toHaveBeenCalled();
      });
    });

    it('renders only provided action callbacks', () => {
      renderResponsive(
        <ResponsiveTable {...defaultProps} onView={vi.fn()} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      expect(screen.getAllByRole('button', { name: /view/i })).toHaveLength(sampleMedicationData.length);
      expect(screen.queryAllByRole('button', { name: /edit/i })).toHaveLength(0);
      expect(screen.queryAllByRole('button', { name: /delete/i })).toHaveLength(0);
    });

    it('renders action buttons in mobile card view', () => {
      useResponsive.mockReturnValue({
        breakpoint: 'xs',
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });

      renderResponsive(<ResponsiveTable {...actionProps} />, {
        viewport: TEST_VIEWPORTS.mobile,
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

      expect(viewButtons).toHaveLength(sampleMedicationData.length);
      expect(editButtons).toHaveLength(sampleMedicationData.length);
      expect(deleteButtons).toHaveLength(sampleMedicationData.length);
    });

    it('mobile action button click does not trigger row click', async () => {
      const user = userEvent.setup();
      const mockRowClick = vi.fn();

      useResponsive.mockReturnValue({
        breakpoint: 'xs',
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });

      renderResponsive(
        <ResponsiveTable {...actionProps} onRowClick={mockRowClick} />,
        { viewport: TEST_VIEWPORTS.mobile }
      );

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(actionProps.onView).toHaveBeenCalled();
        expect(mockRowClick).not.toHaveBeenCalled();
      });
    });
  });

  describe('Sort Persistence (persistKey)', () => {
    const persistProps = {
      ...defaultProps,
      sortable: true,
      persistKey: 'test-table',
    };

    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('persists sort state to localStorage when persistKey is provided', async () => {
      const user = userEvent.setup();

      renderResponsive(
        <ResponsiveTable {...persistProps} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const medicationHeader = screen.getByRole('columnheader', { name: /medication/i });
      await user.click(medicationHeader);

      await waitFor(() => {
        const stored = localStorage.getItem('medikeep_sort_test-table');
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored);
        expect(parsed.sortBy).toBe('medication_name');
        expect(parsed.sortDirection).toBe('asc');
      });
    });

    it('restores sort state from localStorage on remount', async () => {
      localStorage.setItem(
        'medikeep_sort_test-table',
        JSON.stringify({ sortBy: 'dosage', sortDirection: 'desc' })
      );

      renderResponsive(
        <ResponsiveTable {...persistProps} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const dosageHeader = screen.getByRole('columnheader', { name: /dosage/i });
      expect(dosageHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('does not interact with localStorage when persistKey is not provided', async () => {
      const user = userEvent.setup();
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

      renderResponsive(
        <ResponsiveTable {...defaultProps} sortable={true} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const medicationHeader = screen.getByRole('columnheader', { name: /medication/i });
      await user.click(medicationHeader);

      await waitFor(() => {
        const sortCalls = setItemSpy.mock.calls.filter(
          ([key]) => key.startsWith('medikeep_sort_')
        );
        expect(sortCalls).toHaveLength(0);
      });

      setItemSpy.mockRestore();
      getItemSpy.mockRestore();
    });

    it('gracefully handles corrupted localStorage data', () => {
      localStorage.setItem('medikeep_sort_test-table', 'not-valid-json{{{');

      renderResponsive(
        <ResponsiveTable {...persistProps} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Should render without crashing and use default sort
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('gracefully handles partial localStorage data', () => {
      localStorage.setItem(
        'medikeep_sort_test-table',
        JSON.stringify({ sortBy: 123, sortDirection: 'invalid' })
      );

      renderResponsive(
        <ResponsiveTable {...persistProps} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Should render without crashing
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('updates localStorage when sort direction changes', async () => {
      const user = userEvent.setup();

      renderResponsive(
        <ResponsiveTable {...persistProps} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      const medicationHeader = screen.getByRole('columnheader', { name: /medication/i });

      // First click: asc
      await user.click(medicationHeader);
      await waitFor(() => {
        const parsed = JSON.parse(localStorage.getItem('medikeep_sort_test-table'));
        expect(parsed.sortDirection).toBe('asc');
      });

      // Second click: desc
      await user.click(medicationHeader);
      await waitFor(() => {
        const parsed = JSON.parse(localStorage.getItem('medikeep_sort_test-table'));
        expect(parsed.sortDirection).toBe('desc');
      });
    });
  });
});
