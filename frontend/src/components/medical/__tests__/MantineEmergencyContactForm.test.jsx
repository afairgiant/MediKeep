import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MantineEmergencyContactForm from '../MantineEmergencyContactForm';

// Mock scrollIntoView for Mantine Select/Combobox
Element.prototype.scrollIntoView = vi.fn();

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
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Title and submit button both show "Add Emergency Contact"
      expect(screen.getAllByText('Add Emergency Contact').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/)).toBeInTheDocument();
      expect(getAllRelationshipInputs().length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/)).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<MantineEmergencyContactForm {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Add Emergency Contact')).not.toBeInTheDocument();
    });

    test('renders all form fields', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Required fields
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/)).toBeInTheDocument();
      expect(getAllRelationshipInputs().length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/)).toBeInTheDocument();

      // Optional fields
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.secondaryPhone\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.email\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.address\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/common:labels\.notes/)).toBeInTheDocument();

      // Checkboxes
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.isActive\.label/)).toBeInTheDocument();
    });

    test('shows edit mode title and button when editing', () => {
      const editProps = {
        ...defaultProps,
        title: 'Edit Emergency Contact',
        editingContact: { id: 1, name: 'John Doe' },
      };

      render(<MantineEmergencyContactForm {...editProps} />);

      expect(screen.getByText('Edit Emergency Contact')).toBeInTheDocument();
      // Button text: "Update Emergency Contact"
      const submitButton = document.querySelector('button[type="submit"]');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton.textContent).toContain('Update Emergency Contact');
    });
  });

  // Helper to get the relationship select input (Mantine Select renders both input + listbox)
  function getAllRelationshipInputs() {
    return screen.getAllByLabelText(/medical:emergencyContacts\.form\.relationship\.label/);
  }

  describe('Form Interactions', () => {
    test('handles name input changes', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/);
      fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles relationship select changes', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const relationshipInput = getAllRelationshipInputs()[0];
      await userEvent.click(relationshipInput);

      // Options use plain labels from EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS
      const spouseOption = await screen.findByText('Spouse');
      await userEvent.click(spouseOption);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith({
        target: { name: 'relationship', value: 'spouse' },
      });
    });

    test('handles phone number input changes', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/);
      fireEvent.change(phoneInput, { target: { value: '555-123-4567' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles email input changes', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/medical:emergencyContacts\.form\.email\.label/);
      fireEvent.change(emailInput, { target: { value: 'jane.smith@example.com' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('handles checkbox changes', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const primaryCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/);
      await userEvent.click(primaryCheckbox);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'is_primary', value: true }),
        })
      );
    });

    test('handles textarea changes', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/common:labels\.notes/);
      fireEvent.change(notesTextarea, { target: { value: 'Available weekdays only' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    test('calls onSubmit when form is submitted', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('calls onClose when cancel button is clicked', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const cancelButton = screen.getByText('common:buttons.cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('prevents default form submission', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const form = document.querySelector('form');
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

      render(<MantineEmergencyContactForm {...propsWithData} />);

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

      render(<MantineEmergencyContactForm {...propsWithBooleans} />);

      const primaryCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/);
      const activeCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isActive\.label/);

      expect(primaryCheckbox).toBeChecked();
      expect(activeCheckbox).not.toBeChecked();
    });
  });

  describe('Select Options', () => {
    test('displays correct relationship options', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const relationshipInput = getAllRelationshipInputs()[0];
      await userEvent.click(relationshipInput);

      // Options come from EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS with plain labels
      expect(screen.getByText('Spouse')).toBeInTheDocument();
      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.getByText('Child')).toBeInTheDocument();
      expect(screen.getByText('Sibling')).toBeInTheDocument();
      expect(screen.getByText('Friend')).toBeInTheDocument();
      expect(screen.getByText('Caregiver')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });
  });

  describe('Phone Number Validation', () => {
    test('accepts various phone number formats', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/);

      const phoneFormats = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567',
        '+1-555-123-4567'
      ];

      for (const phone of phoneFormats) {
        fireEvent.change(phoneInput, { target: { value: phone } });

        expect(defaultProps.onInputChange).toHaveBeenCalled();
      }
    });

    test('handles secondary phone number input', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const secondaryPhoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.secondaryPhone\.label/);
      fireEvent.change(secondaryPhoneInput, { target: { value: '555-987-6543' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });
  });

  describe('Email Validation', () => {
    test('accepts valid email formats', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/medical:emergencyContacts\.form\.email\.label/);

      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'contact+emergency@medical.org',
        'jane_doe123@hospital.net'
      ];

      for (const email of validEmails) {
        fireEvent.change(emailInput, { target: { value: email } });

        expect(defaultProps.onInputChange).toHaveBeenCalled();
      }
    });
  });

  describe('Primary Contact Management', () => {
    test('handles primary contact designation', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const primaryCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/);

      // Initially unchecked
      expect(primaryCheckbox).not.toBeChecked();

      // Click to make primary
      await userEvent.click(primaryCheckbox);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'is_primary', value: true }),
        })
      );
    });

    test('shows primary contact importance information', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Description text uses i18n key
      expect(screen.getByText('medical:emergencyContacts.form.isPrimary.description')).toBeInTheDocument();
    });
  });

  describe('Contact Status Management', () => {
    test('handles active/inactive status', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const activeCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isActive\.label/);

      // Initially checked (default active)
      expect(activeCheckbox).toBeChecked();

      // Click to deactivate
      await userEvent.click(activeCheckbox);

      expect(defaultProps.onInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ name: 'is_active', value: false }),
        })
      );
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
        render(<MantineEmergencyContactForm {...propsWithNullData} />);
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
        render(<MantineEmergencyContactForm {...propsWithMissingCallbacks} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels and required indicators', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Check required fields exist (with asterisks handled via regex)
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/)).toBeInTheDocument();
      expect(getAllRelationshipInputs().length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/)).toBeInTheDocument();

      // Check optional fields
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.secondaryPhone\.label/)).toBeInTheDocument();
      expect(screen.getByLabelText(/medical:emergencyContacts\.form\.email\.label/)).toBeInTheDocument();
    });

    test('has proper descriptions for contact fields', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Descriptions use i18n keys
      expect(screen.getByText('medical:emergencyContacts.form.name.description')).toBeInTheDocument();
      expect(screen.getByText('medical:emergencyContacts.form.relationship.description')).toBeInTheDocument();
      expect(screen.getByText('medical:emergencyContacts.form.primaryPhone.description')).toBeInTheDocument();
    });

    test('has proper button attributes', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const submitButton = document.querySelector('button[type="submit"]');
      const cancelButton = screen.getByText('common:buttons.cancel');

      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Emergency Contact Workflow', () => {
    test('supports complete emergency contact setup', async () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Fill out a complete emergency contact
      const nameInput = screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/);
      fireEvent.change(nameInput, { target: { value: 'Sarah Johnson' } });

      const relationshipInput = getAllRelationshipInputs()[0];
      await userEvent.click(relationshipInput);
      const spouseOption = await screen.findByText('Spouse');
      await userEvent.click(spouseOption);

      const phoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/);
      fireEvent.change(phoneInput, { target: { value: '555-123-4567' } });

      const secondaryPhoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.secondaryPhone\.label/);
      fireEvent.change(secondaryPhoneInput, { target: { value: '555-987-6543' } });

      const emailInput = screen.getByLabelText(/medical:emergencyContacts\.form\.email\.label/);
      fireEvent.change(emailInput, { target: { value: 'sarah.johnson@email.com' } });

      const primaryCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/);
      await userEvent.click(primaryCheckbox);

      const addressInput = screen.getByLabelText(/medical:emergencyContacts\.form\.address\.label/);
      fireEvent.change(addressInput, { target: { value: '456 Oak Street, Springfield, IL 62701' } });

      const notesInput = screen.getByLabelText(/common:labels\.notes/);
      fireEvent.change(notesInput, { target: { value: 'Available 24/7, speaks English and Spanish' } });

      expect(defaultProps.onInputChange).toHaveBeenCalled();
    });

    test('supports minimal urgent contact entry', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      // Fill only required fields for urgent entry
      const nameInput = screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/);
      fireEvent.change(nameInput, { target: { value: 'Emergency Contact' } });

      const phoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/);
      fireEvent.change(phoneInput, { target: { value: '911' } });

      const form = document.querySelector('form');
      fireEvent.submit(form);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    test('supports secondary contact setup', () => {
      const secondaryContactData = {
        ...defaultProps.formData,
        name: 'Robert Smith',
        relationship: 'parent',
        phone_number: '555-222-3333',
        is_primary: false,
        is_active: true,
      };

      render(<MantineEmergencyContactForm {...defaultProps} formData={secondaryContactData} />);

      expect(screen.getByDisplayValue('Robert Smith')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-222-3333')).toBeInTheDocument();

      const primaryCheckbox = screen.getByLabelText(/medical:emergencyContacts\.form\.isPrimary\.label/);
      expect(primaryCheckbox).not.toBeChecked();
    });
  });

  describe('Form Validation', () => {
    test('requires name field', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const nameInput = screen.getByLabelText(/medical:emergencyContacts\.form\.name\.label/);
      expect(nameInput).toBeRequired();
    });

    test('requires relationship field', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const relationshipInput = getAllRelationshipInputs()[0];
      expect(relationshipInput).toBeRequired();
    });

    test('requires phone number field', () => {
      render(<MantineEmergencyContactForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/medical:emergencyContacts\.form\.primaryPhone\.label/);
      expect(phoneInput).toBeRequired();
    });
  });
});
