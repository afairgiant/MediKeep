import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import MantineEmergencyContactForm from '../MantineEmergencyContactForm';

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('MantineEmergencyContactForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Add Emergency Contact',
    formData: {
      name: '',
      relationship: '',
      phone_number: '',
      secondary_phone: '',
      email: '',
      is_primary: false,
      is_active: true,
      address: '',
      notes: '',
    },
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    editingContact: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders form modal when open', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Add Emergency Contact')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Relationship *')).toBeInTheDocument();
      expect(screen.getByLabelText('Primary Phone *')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Add Emergency Contact')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      // Required fields
      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Relationship *')).toBeInTheDocument();
      expect(screen.getByLabelText('Primary Phone *')).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText('Secondary Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Additional Notes')).toBeInTheDocument();

      // Checkboxes
      expect(screen.getByLabelText('Primary Emergency Contact')).toBeInTheDocument();
      expect(screen.getByLabelText('Active Contact')).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Emergency Contact',
        editingContact: { id: 1, name: 'John Doe' },
      };

      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...editProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Edit Emergency Contact')).toBeInTheDocument();
      expect(screen.getByText('Update Contact')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('handles name input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const nameInput = screen.getByLabelText('Full Name *');
      await user.type(nameInput, 'Jane Smith');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'name', value: 'Jane Smith' },
      });
    });

    test('handles relationship select changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const relationshipSelect = screen.getByLabelText('Relationship *');
      await user.click(relationshipSelect);
      
      const spouseOption = screen.getByText('Spouse - Marriage partner');
      await user.click(spouseOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'relationship', value: 'spouse' },
      });
    });

    test('handles phone number input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const phoneInput = screen.getByLabelText('Primary Phone *');
      await user.type(phoneInput, '555-123-4567');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'phone_number', value: '555-123-4567' },
      });
    });

    test('handles email input changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'jane.smith@example.com');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'email', value: 'jane.smith@example.com' },
      });
    });

    test('handles checkbox changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const primaryCheckbox = screen.getByLabelText('Primary Emergency Contact');
      await user.click(primaryCheckbox);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'is_primary', value: true },
      });
    });

    test('handles textarea changes', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const notesTextarea = screen.getByLabelText('Additional Notes');
      await user.type(notesTextarea, 'Available weekdays only');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'notes', value: 'Available weekdays only' },
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Contact');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const form = screen.getByRole('form');
      
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Data Population', () => {
    test('populates form with existing contact data', () => {
      const populatedData = {
        name: 'John Doe',
        relationship: 'spouse',
        phone_number: '555-123-4567',
        secondary_phone: '555-987-6543',
        email: 'john.doe@example.com',
        is_primary: true,
        is_active: true,
        address: '123 Main St, Anytown, USA',
        notes: 'Emergency contact information',
      };

      const propsWithData = {
        ...defaultProps,
        formData: populatedData,
      };

      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...propsWithData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-123-4567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-987-6543')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Main St, Anytown, USA')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Emergency contact information')).toBeInTheDocument();
    });

    test('handles boolean values correctly', () => {
      const propsWithBooleans = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          is_primary: true,
          is_active: false,
        },
      };

      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...propsWithBooleans} />
        </MantineWrapper>
      );

      const primaryCheckbox = screen.getByLabelText('Primary Emergency Contact');
      const activeCheckbox = screen.getByLabelText('Active Contact');
      
      expect(primaryCheckbox).toBeChecked();
      expect(activeCheckbox).not.toBeChecked();
    });
  });

  describe('Select Options', () => {
    test('displays correct relationship options', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const relationshipSelect = screen.getByLabelText('Relationship *');
      await user.click(relationshipSelect);

      expect(screen.getByText('Spouse - Marriage partner')).toBeInTheDocument();
      expect(screen.getByText('Parent - Father or mother')).toBeInTheDocument();
      expect(screen.getByText('Child - Son or daughter')).toBeInTheDocument();
      expect(screen.getByText('Sibling - Brother or sister')).toBeInTheDocument();
      expect(screen.getByText('Friend - Close friend')).toBeInTheDocument();
      expect(screen.getByText('Caregiver - Professional caregiver')).toBeInTheDocument();
      expect(screen.getByText('Other - Other relationship')).toBeInTheDocument();
    });
  });

  describe('Phone Number Validation', () => {
    test('accepts various phone number formats', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const phoneInput = screen.getByLabelText('Primary Phone *');
      
      const phoneFormats = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567',
        '+1-555-123-4567'
      ];
      
      for (const phone of phoneFormats) {
        await user.clear(phoneInput);
        await user.type(phoneInput, phone);
        
        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'phone_number', value: phone },
        });
      }
    });

    test('handles secondary phone number input', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const secondaryPhoneInput = screen.getByLabelText('Secondary Phone');
      await user.type(secondaryPhoneInput, '555-987-6543');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'secondary_phone', value: '555-987-6543' },
      });
    });
  });

  describe('Email Validation', () => {
    test('accepts valid email formats', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const emailInput = screen.getByLabelText('Email Address');
      
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'contact+emergency@medical.org',
        'jane_doe123@hospital.net'
      ];
      
      for (const email of validEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, email);
        
        expect(defaultProps.onInputChange).toHaveBeenCalledWith({
          target: { name: 'email', value: email },
        });
      }
    });
  });

  describe('Primary Contact Management', () => {
    test('handles primary contact designation', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const primaryCheckbox = screen.getByLabelText('Primary Emergency Contact');
      
      // Initially unchecked
      expect(primaryCheckbox).not.toBeChecked();
      
      // Click to make primary
      await user.click(primaryCheckbox);
      
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'is_primary', value: true },
      });
    });

    test('shows primary contact importance information', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('This person will be contacted first in emergencies')).toBeInTheDocument();
    });
  });

  describe('Contact Status Management', () => {
    test('handles active/inactive status', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const activeCheckbox = screen.getByLabelText('Active Contact');
      
      // Initially checked (default active)
      expect(activeCheckbox).toBeChecked();
      
      // Click to deactivate
      await user.click(activeCheckbox);
      
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'is_active', value: false },
      });
    });
  });

  describe('Error Handling', () => {
    test('handles null/undefined form data gracefully', () => {
      const propsWithNullData = {
        ...defaultProps,
        formData: {
          name: null,
          relationship: undefined,
          phone_number: '',
        },
      };

      expect(() => {
        render(
          <MantineWrapper>
            <MantineEmergencyContactForm {...propsWithNullData} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });

    test('handles missing callback functions gracefully', () => {
      const propsWithMissingCallbacks = {
        ...defaultProps,
        onInputChange: undefined,
        onSubmit: undefined,
        onClose: undefined,
      };

      expect(() => {
        render(
          <MantineWrapper>
            <MantineEmergencyContactForm {...propsWithMissingCallbacks} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      // Check required fields have asterisks
      expect(screen.getByLabelText('Full Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Relationship *')).toBeInTheDocument();
      expect(screen.getByLabelText('Primary Phone *')).toBeInTheDocument();

      // Check optional fields don't have asterisks
      expect(screen.getByLabelText('Secondary Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    test('has proper descriptions for contact fields', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Primary person to contact in case of emergency')).toBeInTheDocument();
      expect(screen.getByText('Relationship to the patient')).toBeInTheDocument();
      expect(screen.getByText('Main phone number to reach this contact')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const submitButton = screen.getByText('Add Contact');
      const cancelButton = screen.getByText('Cancel');

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Emergency Contact Workflow', () => {
    test('supports complete emergency contact setup', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      // Fill out a complete emergency contact
      await user.type(screen.getByLabelText('Full Name *'), 'Sarah Johnson');
      
      await user.click(screen.getByLabelText('Relationship *'));
      await user.click(screen.getByText('Spouse - Marriage partner'));
      
      await user.type(screen.getByLabelText('Primary Phone *'), '555-123-4567');
      await user.type(screen.getByLabelText('Secondary Phone'), '555-987-6543');
      await user.type(screen.getByLabelText('Email Address'), 'sarah.johnson@email.com');
      
      await user.click(screen.getByLabelText('Primary Emergency Contact'));
      
      await user.type(screen.getByLabelText('Address'), '456 Oak Street, Springfield, IL 62701');
      await user.type(screen.getByLabelText('Additional Notes'), 'Available 24/7, speaks English and Spanish');

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'name', value: 'Sarah Johnson' },
      });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'relationship', value: 'spouse' },
      });
      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'is_primary', value: true },
      });
    });

    test('supports minimal urgent contact entry', async () => {
      const user = userEvent.setup();
      
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      // Fill only required fields for urgent entry
      await user.type(screen.getByLabelText('Full Name *'), 'Emergency Contact');
      
      await user.click(screen.getByLabelText('Relationship *'));
      await user.click(screen.getByText('Friend - Close friend'));
      
      await user.type(screen.getByLabelText('Primary Phone *'), '911');

      const submitButton = screen.getByText('Add Contact');
      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('supports secondary contact setup', async () => {
      const user = userEvent.setup();
      
      const secondaryContactData = {
        ...defaultProps.formData,
        name: 'Robert Smith',
        relationship: 'parent',
        phone_number: '555-222-3333',
        is_primary: false,
        is_active: true,
      };

      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} formData={secondaryContactData} />
        </MantineWrapper>
      );

      expect(screen.getByDisplayValue('Robert Smith')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-222-3333')).toBeInTheDocument();
      
      const primaryCheckbox = screen.getByLabelText('Primary Emergency Contact');
      expect(primaryCheckbox).not.toBeChecked();
    });
  });

  describe('Form Validation', () => {
    test('requires name field', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const nameInput = screen.getByLabelText('Full Name *');
      expect(nameInput).toBeRequired();
    });

    test('requires relationship field', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const relationshipSelect = screen.getByLabelText('Relationship *');
      expect(relationshipSelect).toBeRequired();
    });

    test('requires phone number field', () => {
      render(
        <MantineWrapper>
          <MantineEmergencyContactForm {...defaultProps} />
        </MantineWrapper>
      );

      const phoneInput = screen.getByLabelText('Primary Phone *');
      expect(phoneInput).toBeRequired();
    });
  });
});
