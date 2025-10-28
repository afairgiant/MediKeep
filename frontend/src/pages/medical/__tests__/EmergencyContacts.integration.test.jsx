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
import EmergencyContacts from '../EmergencyContacts';
import { useMedicalData } from '../../../hooks/useMedicalData';
import { useDataManagement } from '../../../hooks/useDataManagement';

// Mock the hooks that make API calls
vi.mock('../../../hooks/useMedicalData');
vi.mock('../../../hooks/useDataManagement');

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('Emergency Contacts Page Integration Tests', () => {
  const mockEmergencyContacts = [
    {
      id: 1,
      name: 'Sarah Johnson',
      relationship: 'spouse',
      phone_number: '(555) 123-4567',
      secondary_phone: '(555) 987-6543',
      email: 'sarah.johnson@email.com',
      is_primary: true,
      is_active: true,
      address: '123 Main St, Anytown, ST 12345',
      notes: 'Available 24/7. Works from home.',
      patient_id: 1,
    },
    {
      id: 2,
      name: 'Michael Johnson',
      relationship: 'child',
      phone_number: '(555) 456-7890',
      secondary_phone: null,
      email: 'mike.johnson@email.com',
      is_primary: false,
      is_active: true,
      address: '456 Oak Ave, Another City, ST 67890',
      notes: 'Lives nearby. Available evenings and weekends.',
      patient_id: 1,
    },
    {
      id: 3,
      name: 'Dr. Emily Chen',
      relationship: 'physician',
      phone_number: '(555) 111-2222',
      secondary_phone: '(555) 333-4444',
      email: 'dr.chen@medicalcenter.com',
      is_primary: false,
      is_active: true,
      address: 'Medical Center, 789 Health Blvd, Medical City, ST 11111',
      notes: 'Primary care physician. Emergency contact for medical decisions.',
      patient_id: 1,
    },
    {
      id: 4,
      name: 'Robert Smith',
      relationship: 'friend',
      phone_number: '(555) 777-8888',
      secondary_phone: null,
      email: null,
      is_primary: false,
      is_active: false,
      address: null,
      notes: 'Backup contact. Moved out of state.',
      patient_id: 1,
    },
  ];

  // Mock data management hook
  const mockDataManagement = {
    data: mockEmergencyContacts,
    filters: {
      search: '',
      relationship: '',
      active_status: '',
    },
    updateFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    statusOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    categoryOptions: [
      { value: 'spouse', label: 'Spouse' },
      { value: 'child', label: 'Child' },
      { value: 'parent', label: 'Parent' },
      { value: 'physician', label: 'Physician' },
      { value: 'friend', label: 'Friend' },
    ],
    dateRangeOptions: [],
    sortOptions: [],
    sortBy: 'name',
    sortOrder: 'asc',
    handleSortChange: vi.fn(),
    totalCount: mockEmergencyContacts.length,
    filteredCount: mockEmergencyContacts.length,
  };

  beforeEach(() => {
    // Mock the hooks to return our test data

    vi.mocked(useMedicalData).mockReturnValue({
      items: mockEmergencyContacts,
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

    useDataManagement.mockReturnValue(mockDataManagement);

    // Setup MSW handlers for API calls
    server.use(
      rest.get('/api/v1/emergency-contacts', (req, res, ctx) => {
        return res(ctx.json(mockEmergencyContacts));
      }),
      rest.post('/api/v1/emergency-contacts', (req, res, ctx) => {
        const newContact = { id: 5, ...req.body };
        return res(ctx.json(newContact));
      }),
      rest.put('/api/v1/emergency-contacts/:id', (req, res, ctx) => {
        const updatedContact = { ...mockEmergencyContacts[0], ...req.body };
        return res(ctx.json(updatedContact));
      }),
      rest.delete('/api/v1/emergency-contacts/:id', (req, res, ctx) => {
        return res(ctx.status(200));
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders emergency contacts page with initial data', async () => {
      renderWithPatient(<EmergencyContacts />);

      // Check page header
      expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();
      
      // Check that contacts are displayed
      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
        expect(screen.getByText('Robert Smith')).toBeInTheDocument();
      });
    });

    test('displays contact relationships and phone numbers', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Check relationships are displayed
      expect(screen.getByText('Spouse')).toBeInTheDocument();
      expect(screen.getByText('Child')).toBeInTheDocument();
      expect(screen.getByText('Physician')).toBeInTheDocument();
      expect(screen.getByText('Friend')).toBeInTheDocument();

      // Check formatted phone numbers
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('(555) 456-7890')).toBeInTheDocument();
      expect(screen.getByText('(555) 111-2222')).toBeInTheDocument();
    });

    test('shows primary contact designation and status', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Check primary contact badge
      expect(screen.getByText('Primary')).toBeInTheDocument();

      // Check active status badges
      expect(screen.getAllByText('Active')).toHaveLength(3);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    test('displays contact information and notes', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Check email addresses
      expect(screen.getByText('sarah.johnson@email.com')).toBeInTheDocument();
      expect(screen.getByText('dr.chen@medicalcenter.com')).toBeInTheDocument();

      // Check notes
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
      expect(screen.getByText('Primary care physician. Emergency contact for medical decisions.')).toBeInTheDocument();
    });
  });

  describe('Emergency Contact CRUD Operations', () => {
    test('creates a new emergency contact through complete workflow', async () => {
      
      const mockCreateItem = vi.fn().mockResolvedValue({});
      
        vi.mocked(useMedicalData).mockReturnValue({
        items: mockEmergencyContacts,
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

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Click Add Emergency Contact button
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByText('Add New Emergency Contact')).toBeInTheDocument();

      // Fill out the form
      await userEvent.type(screen.getByLabelText('Name *'), 'Jennifer Wilson');
      
      // Select relationship
      await userEvent.click(screen.getByLabelText('Relationship'));
      await userEvent.click(screen.getByText('Sister - Sister'));

      // Add phone number
      await userEvent.type(screen.getByLabelText('Phone Number *'), '(555) 999-0000');

      // Add secondary phone
      await userEvent.type(screen.getByLabelText('Secondary Phone'), '(555) 888-7777');

      // Add email
      await userEvent.type(screen.getByLabelText('Email'), 'jen.wilson@email.com');

      // Add address
      await userEvent.type(screen.getByLabelText('Address'), '321 Pine St, Nearby Town, ST 54321');

      // Add notes
      await userEvent.type(screen.getByLabelText('Notes'), 'Sister living nearby. Available for emergencies. Nurse by profession.');

      // Set as active (should be default)
      expect(screen.getByLabelText('Is Active')).toBeChecked();

      // Submit form
      const submitButton = screen.getByText('Add Contact');
      await userEvent.click(submitButton);

      // Verify createItem was called with correct data
      expect(mockCreateItem).toHaveBeenCalledWith({
        name: 'Jennifer Wilson',
        relationship: 'sister',
        phone_number: '(555) 999-0000',
        secondary_phone: '(555) 888-7777',
        email: 'jen.wilson@email.com',
        is_primary: false,
        is_active: true,
        address: '321 Pine St, Nearby Town, ST 54321',
        notes: 'Sister living nearby. Available for emergencies. Nurse by profession.',
        patient_id: 1,
      });
    });

    test('edits existing contact with primary designation change', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
        vi.mocked(useMedicalData).mockReturnValue({
        items: mockEmergencyContacts,
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

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      });

      // Find and click edit button for Michael Johnson
      const michaelCard = screen.getByText('Michael Johnson').closest('.mantine-Card-root, .card');
      const editButton = within(michaelCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Modal should open with pre-filled data
      expect(screen.getByText('Edit Emergency Contact')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Michael Johnson')).toBeInTheDocument();

      // Set as primary contact
      await userEvent.click(screen.getByLabelText('Primary Contact'));

      // Update phone number
      const phoneField = screen.getByLabelText('Phone Number *');
      await userEvent.clear(phoneField);
      await userEvent.type(phoneField, '(555) 456-7899');

      // Update notes
      const notesField = screen.getByLabelText('Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Lives nearby. Available evenings and weekends. Now primary emergency contact.');

      // Submit changes
      const updateButton = screen.getByText('Update Contact');
      await userEvent.click(updateButton);

      // Verify updateItem was called
      expect(mockUpdateItem).toHaveBeenCalledWith(2, expect.objectContaining({
        is_primary: true,
        phone_number: '(555) 456-7899',
        notes: 'Lives nearby. Available evenings and weekends. Now primary emergency contact.',
      }));
    });

    test('deactivates emergency contact instead of deleting', async () => {
      
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      
        vi.mocked(useMedicalData).mockReturnValue({
        items: mockEmergencyContacts,
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

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      // Edit Dr. Chen to deactivate
      const drChenCard = screen.getByText('Dr. Emily Chen').closest('.mantine-Card-root, .card');
      const editButton = within(drChenCard || document.body).getByText('Edit');
      await userEvent.click(editButton);

      // Uncheck active status
      await userEvent.click(screen.getByLabelText('Is Active'));

      // Update notes to reflect deactivation
      const notesField = screen.getByLabelText('Notes');
      await userEvent.clear(notesField);
      await userEvent.type(notesField, 'Former primary care physician. No longer available for emergency contact.');

      const updateButton = screen.getByText('Update Contact');
      await userEvent.click(updateButton);

      // Verify contact was deactivated, not deleted
      expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({
        is_active: false,
        notes: 'Former primary care physician. No longer available for emergency contact.',
      }));
    });

    test('deletes emergency contact with confirmation', async () => {
      
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      
        vi.mocked(useMedicalData).mockReturnValue({
        items: mockEmergencyContacts,
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

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Robert Smith')).toBeInTheDocument();
      });

      // Find and click delete button for inactive contact
      const robertCard = screen.getByText('Robert Smith').closest('.mantine-Card-root, .card');
      const deleteButton = within(robertCard || document.body).getByText('Delete');
      await userEvent.click(deleteButton);

      // Verify deleteItem was called
      expect(mockDeleteItem).toHaveBeenCalledWith(4);
    });
  });

  describe('Contact Priority and Management', () => {
    test('displays primary contact prominently', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Primary contact should have special designation
      const sarahCard = screen.getByText('Sarah Johnson').closest('.mantine-Card-root, .card');
      expect(within(sarahCard || document.body).getByText('Primary')).toBeInTheDocument();

      // Should show availability notes
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
    });

    test('manages multiple phone numbers for contacts', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Should show both primary and secondary phone numbers
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('(555) 987-6543')).toBeInTheDocument();

      // Dr. Chen should show both phone numbers
      expect(screen.getByText('(555) 111-2222')).toBeInTheDocument();
      expect(screen.getByText('(555) 333-4444')).toBeInTheDocument();
    });

    test('handles professional emergency contacts', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      // Professional contact should show institutional information
      expect(screen.getByText('Physician')).toBeInTheDocument();
      expect(screen.getByText('dr.chen@medicalcenter.com')).toBeInTheDocument();
      expect(screen.getByText('Medical Center, 789 Health Blvd, Medical City, ST 11111')).toBeInTheDocument();
      expect(screen.getByText('Primary care physician. Emergency contact for medical decisions.')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    test('filters contacts by relationship type', async () => {
      
      
      // Mock filtered data for family relationships
        vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c => ['spouse', 'child'].includes(c.relationship)),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Apply family filter
      const relationshipFilter = screen.getByLabelText('Relationship');
      await userEvent.click(relationshipFilter);
      await userEvent.click(screen.getByText('Family'));

      // Should only show family members
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Dr. Emily Chen')).not.toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });

    test('filters contacts by active status', async () => {
      
      
      // Mock filtered data for active contacts
        vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c => c.is_active),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Apply active filter
      const statusFilter = screen.getByLabelText('Status');
      await userEvent.click(statusFilter);
      await userEvent.click(screen.getByText('Active'));

      // Should only show active contacts
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });

    test('searches contacts by name and notes', async () => {
      
      
      // Mock filtered data for physician search
        vi.mocked(useDataManagement).mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c => 
          c.name.toLowerCase().includes('chen') || 
          c.notes?.toLowerCase().includes('physician')
        ),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      // Search for physician
      const searchInput = screen.getByPlaceholderText('Search emergency contacts...');
      await userEvent.type(searchInput, 'physician');

      // Should only show Dr. Chen
      expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Michael Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Initially in cards view
      expect(screen.getByText('Cards')).toBeInTheDocument();

      // Switch to table view
      const tableButton = screen.getByText('Table');
      await userEvent.click(tableButton);

      // Should now show table headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Relationship')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  describe('Emergency Contact Workflow', () => {
    test('manages primary contact designation', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Should clearly show primary contact
      const sarahCard = screen.getByText('Sarah Johnson').closest('.mantine-Card-root, .card');
      expect(within(sarahCard || document.body).getByText('Primary')).toBeInTheDocument();

      // Primary should be prominently displayed
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
    });

    test('handles medical emergency contact workflow', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Add medical professional as emergency contact
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Name *'), 'Dr. James Rodriguez');
      
      await userEvent.click(screen.getByLabelText('Relationship'));
      await userEvent.click(screen.getByText('Physician - Physician'));

      await userEvent.type(screen.getByLabelText('Phone Number *'), '(555) 444-5555');
      await userEvent.type(screen.getByLabelText('Email'), 'dr.rodriguez@hospital.com');
      await userEvent.type(screen.getByLabelText('Notes'), 'Cardiologist. Contact for cardiac emergency decisions. On-call 24/7.');

      const submitButton = screen.getByText('Add Contact');
      await userEvent.click(submitButton);

      // Should capture medical emergency contact context
      expect(screen.getByText('Contact for cardiac emergency decisions.')).toBeInTheDocument();
    });

    test('validates contact information completeness', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      // Try to submit without required fields
      const submitButton = screen.getByText('Add Contact');
      await userEvent.click(submitButton);

      // Should show validation errors
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      
      const mockCreateItem = vi.fn().mockRejectedValue(new Error('Network error'));
      
        vi.mocked(useMedicalData).mockReturnValue({
        items: mockEmergencyContacts,
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

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Try to create contact
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Name *'), 'Test Contact');
      await userEvent.type(screen.getByLabelText('Phone Number *'), '(555) 123-4567');
      
      const submitButton = screen.getByText('Add Contact');
      await userEvent.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create emergency contact')).toBeInTheDocument();
      });
    });

    test('handles contacts with minimal information', () => {
      const minimalContacts = [
        {
          id: 1,
          name: 'Basic Contact',
          relationship: 'friend',
          phone_number: '(555) 000-0000',
          secondary_phone: null,
          email: null,
          is_primary: false,
          is_active: true,
          address: null,
          notes: null,
          patient_id: 1,
        },
      ];

          
      vi.mocked(useMedicalData).mockReturnValue({
        items: minimalContacts,
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
        data: minimalContacts,
      });

      renderWithPatient(<EmergencyContacts />);

      // Should still render without errors
      expect(screen.getByText('Emergency Contacts')).toBeInTheDocument();
      expect(screen.getByText('Basic Contact')).toBeInTheDocument();
    });

    test('displays empty state when no contacts exist', () => {
          
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

      renderWithPatient(<EmergencyContacts />);

      expect(screen.getByText('No emergency contacts found')).toBeInTheDocument();
      expect(screen.getByText('Start by adding your first emergency contact.')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates phone number format', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Name *'), 'Test Contact');
      
      // Enter invalid phone format
      await userEvent.type(screen.getByLabelText('Phone Number *'), '123-456');

      // Should show validation error
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });

    test('validates email format', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Name *'), 'Test Contact');
      await userEvent.type(screen.getByLabelText('Phone Number *'), '(555) 123-4567');
      
      // Enter invalid email format
      await userEvent.type(screen.getByLabelText('Email'), 'invalid-email');

      // Should show validation error
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    test('prevents multiple primary contacts', async () => {
      
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      });

      // Try to add another primary contact
      const addButton = screen.getByText('Add Emergency Contact');
      await userEvent.click(addButton);

      await userEvent.type(screen.getByLabelText('Name *'), 'Another Primary');
      await userEvent.type(screen.getByLabelText('Phone Number *'), '(555) 999-8888');
      
      await userEvent.click(screen.getByLabelText('Primary Contact'));

      // Should show warning about existing primary contact
      expect(screen.getByText('There is already a primary contact. Setting this as primary will remove the designation from the current primary contact.')).toBeInTheDocument();
    });
  });
});
