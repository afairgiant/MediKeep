import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import components to test
import MantineAllergyForm from '../../components/medical/MantineAllergyForm';
import MantineMedicationForm from '../../components/medical/MantineMedicationForm';
import MantineConditionForm from '../../components/medical/MantineConditionForm';
import MantineImmunizationForm from '../../components/medical/MantineImmunizationForm';

// Import test utilities
import {
  renderResponsive,
  testAtAllBreakpoints,
  simulateFormSubmission,
  mockMedicalData,
  testMedicalFormAtAllBreakpoints,
  TEST_VIEWPORTS,
  mockViewport
} from './ResponsiveTestUtils';

import logger from '../../services/logger';

// Mock logger to avoid console noise during tests
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API calls
const mockOnSubmit = vi.fn();
const mockOnClose = vi.fn();
const mockOnInputChange = vi.fn();

// Mock data
const mockPractitioners = [
  { id: 1, name: 'Dr. Smith', specialty: 'Cardiology' },
  { id: 2, name: 'Dr. Johnson', specialty: 'Neurology' }
];

const mockMedications = [
  { id: 1, medication_name: 'Aspirin', strength: '325mg' },
  { id: 2, medication_name: 'Lisinopril', strength: '10mg' }
];

describe('Medical Form Submission Tests - Responsive Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockClear();
    mockOnClose.mockClear();
    mockOnInputChange.mockClear();
  });

  afterEach(() => {
    // Clean up any hanging timers or async operations
    vi.runOnlyPendingTimers();
  });

  describe('Medication Form Submission', () => {
    const defaultMedicationProps = {
      isOpen: true,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
      onInputChange: mockOnInputChange,
      title: 'Add Medication',
      formData: {},
      practitionersOptions: mockPractitioners,
      practitionersLoading: false
    };

    const medicationFormData = mockMedicalData.medication({
      medication_name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      prescribing_practitioner: '1'
    });

    testAtAllBreakpoints(
      <MantineMedicationForm {...defaultMedicationProps} />,
      (breakpoint, viewport) => {
        describe('Medication Form', () => {
          it('renders all required fields correctly', async () => {
            renderResponsive(<MantineMedicationForm {...defaultMedicationProps} />, { viewport });

            // Check essential fields are present
            expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /dosage/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /frequency/i })).toBeInTheDocument();
            expect(screen.getByRole('combobox', { name: /practitioner/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /save|submit/i })).toBeInTheDocument();
          });

          it('successfully submits medication data', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineMedicationForm {...defaultMedicationProps} />, { viewport });

            // Fill out the form
            await user.type(screen.getByRole('textbox', { name: /medication.*name/i }), medicationFormData.medication_name);
            await user.type(screen.getByRole('textbox', { name: /dosage/i }), medicationFormData.dosage);
            await user.type(screen.getByRole('textbox', { name: /frequency/i }), medicationFormData.frequency);
            
            // Select practitioner
            const practitionerSelect = screen.getByRole('combobox', { name: /practitioner/i });
            await user.click(practitionerSelect);
            await waitFor(() => {
              const option = screen.getByRole('option', { name: /dr.*smith/i });
              expect(option).toBeInTheDocument();
            });
            await user.click(screen.getByRole('option', { name: /dr.*smith/i }));

            // Submit form
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // Verify form submission
            await waitFor(() => {
              expect(mockOnSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                  medication_name: medicationFormData.medication_name,
                  dosage: medicationFormData.dosage,
                  frequency: medicationFormData.frequency,
                  prescribing_practitioner: '1'
                })
              );
            });
          });

          it('handles validation errors appropriately', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineMedicationForm {...defaultMedicationProps} />, { viewport });

            // Try to submit empty form
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // Should show validation errors for required fields
            await waitFor(() => {
              const errorMessages = screen.queryAllByRole('alert');
              expect(errorMessages.length).toBeGreaterThan(0);
            }, { timeout: 3000 });

            // Form should not be submitted
            expect(mockOnSubmit).not.toHaveBeenCalled();
          });

          it('maintains field focus and touch targets on mobile', async () => {
            if (viewport.width <= 575) { // Mobile breakpoint
              const user = userEvent.setup();
              renderResponsive(<MantineMedicationForm {...defaultMedicationProps} />, { viewport });

              const medicationNameField = screen.getByRole('textbox', { name: /medication.*name/i });
              
              // Check field has appropriate mobile styling
              const fieldStyle = getComputedStyle(medicationNameField);
              expect(parseInt(fieldStyle.minHeight)).toBeGreaterThanOrEqual(44); // Minimum touch target
              expect(parseInt(fieldStyle.fontSize)).toBeGreaterThanOrEqual(16); // Prevent zoom
              
              // Test focus behavior
              await user.click(medicationNameField);
              expect(medicationNameField).toHaveFocus();
            }
          });
        });
      }
    );
  });

  describe('Allergy Form Submission', () => {
    const defaultAllergyProps = {
      isOpen: true,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
      onInputChange: mockOnInputChange,
      title: 'Add Allergy',
      formData: {},
      medicationsOptions: mockMedications,
      medicationsLoading: false
    };

    const allergyFormData = mockMedicalData.allergy({
      allergen: 'Shellfish',
      reaction_type: 'Hives',
      severity: 'Moderate'
    });

    testAtAllBreakpoints(
      <MantineAllergyForm {...defaultAllergyProps} />,
      (breakpoint, viewport) => {
        describe('Allergy Form', () => {
          it('renders allergy form with all fields', async () => {
            renderResponsive(<MantineAllergyForm {...defaultAllergyProps} />, { viewport });

            expect(screen.getByRole('textbox', { name: /allergen/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /reaction/i })).toBeInTheDocument();
            expect(screen.getByRole('combobox', { name: /severity/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /save|submit/i })).toBeInTheDocument();
          });

          it('submits allergy data correctly', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineAllergyForm {...defaultAllergyProps} />, { viewport });

            // Fill out allergy form
            await user.type(screen.getByRole('textbox', { name: /allergen/i }), allergyFormData.allergen);
            await user.type(screen.getByRole('textbox', { name: /reaction/i }), allergyFormData.reaction_type);
            
            // Select severity
            const severitySelect = screen.getByRole('combobox', { name: /severity/i });
            await user.click(severitySelect);
            await waitFor(() => {
              const moderateOption = screen.getByRole('option', { name: /moderate/i });
              expect(moderateOption).toBeInTheDocument();
            });
            await user.click(screen.getByRole('option', { name: /moderate/i }));

            // Submit
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            await waitFor(() => {
              expect(mockOnSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                  allergen: allergyFormData.allergen,
                  reaction_type: allergyFormData.reaction_type,
                  severity: allergyFormData.severity
                })
              );
            });
          });

          it('handles severity level validation', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineAllergyForm {...defaultAllergyProps} />, { viewport });

            // Fill required fields but skip severity
            await user.type(screen.getByRole('textbox', { name: /allergen/i }), allergyFormData.allergen);
            await user.type(screen.getByRole('textbox', { name: /reaction/i }), allergyFormData.reaction_type);

            // Try to submit without severity
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // Should require severity selection
            await waitFor(() => {
              const severityField = screen.getByRole('combobox', { name: /severity/i });
              expect(severityField).toHaveAttribute('aria-invalid', 'true');
            });
          });
        });
      }
    );
  });

  describe('Condition Form Submission', () => {
    const defaultConditionProps = {
      isOpen: true,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
      onInputChange: mockOnInputChange,
      title: 'Add Condition',
      formData: {}
    };

    const conditionFormData = mockMedicalData.condition({
      condition_name: 'Hypertension',
      diagnosis_date: '2024-01-15',
      status: 'Active'
    });

    testAtAllBreakpoints(
      <MantineConditionForm {...defaultConditionProps} />,
      (breakpoint, viewport) => {
        describe('Condition Form', () => {
          it('renders condition form fields', async () => {
            renderResponsive(<MantineConditionForm {...defaultConditionProps} />, { viewport });

            expect(screen.getByRole('textbox', { name: /condition.*name/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /diagnosis.*date/i })).toBeInTheDocument();
            expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
          });

          it('submits condition data with proper date formatting', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineConditionForm {...defaultConditionProps} />, { viewport });

            // Fill condition form
            await user.type(screen.getByRole('textbox', { name: /condition.*name/i }), conditionFormData.condition_name);
            
            // Handle date input (might be different input types on different devices)
            const dateField = screen.getByRole('textbox', { name: /diagnosis.*date/i });
            await user.type(dateField, conditionFormData.diagnosis_date);
            
            // Select status
            const statusSelect = screen.getByRole('combobox', { name: /status/i });
            await user.click(statusSelect);
            await waitFor(() => {
              const activeOption = screen.getByRole('option', { name: /active/i });
              expect(activeOption).toBeInTheDocument();
            });
            await user.click(screen.getByRole('option', { name: /active/i }));

            // Submit
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            await waitFor(() => {
              expect(mockOnSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                  condition_name: conditionFormData.condition_name,
                  diagnosis_date: expect.any(String),
                  status: conditionFormData.status
                })
              );
            });
          });

          it('validates required condition name', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineConditionForm {...defaultConditionProps} />, { viewport });

            // Submit without condition name
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // Should show validation error
            await waitFor(() => {
              const conditionNameField = screen.getByRole('textbox', { name: /condition.*name/i });
              expect(conditionNameField).toHaveAttribute('aria-invalid', 'true');
            });

            expect(mockOnSubmit).not.toHaveBeenCalled();
          });
        });
      }
    );
  });

  describe('Immunization Form Submission', () => {
    const defaultImmunizationProps = {
      isOpen: true,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
      onInputChange: mockOnInputChange,
      title: 'Add Immunization',
      formData: {}
    };

    const immunizationFormData = mockMedicalData.immunization({
      vaccine_name: 'Influenza Vaccine',
      date_administered: '2024-01-10',
      practitioner: 'Dr. Wilson'
    });

    testAtAllBreakpoints(
      <MantineImmunizationForm {...defaultImmunizationProps} />,
      (breakpoint, viewport) => {
        describe('Immunization Form', () => {
          it('renders immunization form', async () => {
            renderResponsive(<MantineImmunizationForm {...defaultImmunizationProps} />, { viewport });

            expect(screen.getByRole('textbox', { name: /vaccine.*name/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /date.*administered/i })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /practitioner/i })).toBeInTheDocument();
          });

          it('submits immunization with all data', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineImmunizationForm {...defaultImmunizationProps} />, { viewport });

            // Fill immunization form
            await user.type(screen.getByRole('textbox', { name: /vaccine.*name/i }), immunizationFormData.vaccine_name);
            await user.type(screen.getByRole('textbox', { name: /date.*administered/i }), immunizationFormData.date_administered);
            await user.type(screen.getByRole('textbox', { name: /practitioner/i }), immunizationFormData.practitioner);

            // Submit
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            await waitFor(() => {
              expect(mockOnSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                  vaccine_name: immunizationFormData.vaccine_name,
                  date_administered: expect.any(String),
                  practitioner: immunizationFormData.practitioner
                })
              );
            });
          });

          it('validates vaccine name requirement', async () => {
            const user = userEvent.setup();
            renderResponsive(<MantineImmunizationForm {...defaultImmunizationProps} />, { viewport });

            // Submit without vaccine name
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            await waitFor(() => {
              const vaccineField = screen.getByRole('textbox', { name: /vaccine.*name/i });
              expect(vaccineField).toHaveAttribute('aria-invalid', 'true');
            });
          });
        });
      }
    );
  });

  describe('Cross-Breakpoint Data Integrity', () => {
    it('maintains form data when switching between breakpoints', async () => {
      const formData = mockMedicalData.medication();
      
      // Start with desktop view
      const { rerender } = renderResponsive(
        <MantineMedicationForm {...{
          isOpen: true,
          onClose: mockOnClose,
          onSubmit: mockOnSubmit,
          onInputChange: mockOnInputChange,
          formData,
          practitionersOptions: mockPractitioners
        }} />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Verify fields are populated with formData
      expect(screen.getByDisplayValue(formData.medication_name)).toBeInTheDocument();
      expect(screen.getByDisplayValue(formData.dosage)).toBeInTheDocument();

      // Switch to mobile
      mockViewport(TEST_VIEWPORTS.mobile.width, TEST_VIEWPORTS.mobile.height);
      rerender(<MantineMedicationForm {...{
        isOpen: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        onInputChange: mockOnInputChange,
        formData,
        practitionersOptions: mockPractitioners
      }} />);

      // Data should still be there
      await waitFor(() => {
        expect(screen.getByDisplayValue(formData.medication_name)).toBeInTheDocument();
        expect(screen.getByDisplayValue(formData.dosage)).toBeInTheDocument();
      });
    });

    it('preserves user input during breakpoint transitions', async () => {
      const user = userEvent.setup();
      
      // Start with tablet view
      const { rerender } = renderResponsive(
        <MantineAllergyForm {...{
          isOpen: true,
          onClose: mockOnClose,
          onSubmit: mockOnSubmit,
          onInputChange: mockOnInputChange,
          formData: {},
          medicationsOptions: mockMedications
        }} />,
        { viewport: TEST_VIEWPORTS.tablet }
      );

      // Fill in some data
      const allergenField = screen.getByRole('textbox', { name: /allergen/i });
      await user.type(allergenField, 'Peanuts');

      // Switch to desktop
      mockViewport(TEST_VIEWPORTS.desktop.width, TEST_VIEWPORTS.desktop.height);
      rerender(<MantineAllergyForm {...{
        isOpen: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        onInputChange: mockOnInputChange,
        formData: {},
        medicationsOptions: mockMedications
      }} />);

      // Input should be preserved (if using controlled components properly)
      await waitFor(() => {
        const updatedField = screen.getByRole('textbox', { name: /allergen/i });
        expect(updatedField).toHaveValue('Peanuts');
      });
    });
  });

  describe('Form Performance Tests', () => {
    it('renders forms within acceptable time limits', async () => {
      const forms = [
        { component: MantineMedicationForm, props: { practitionersOptions: mockPractitioners } },
        { component: MantineAllergyForm, props: { medicationsOptions: mockMedications } },
        { component: MantineConditionForm, props: {} },
        { component: MantineImmunizationForm, props: {} }
      ];

      for (const { component: FormComponent, props } of forms) {
        const startTime = performance.now();
        
        const { unmount } = renderResponsive(
          <FormComponent
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            onInputChange={mockOnInputChange}
            formData={{}}
            {...props}
          />,
          { viewport: TEST_VIEWPORTS.mobile }
        );
        
        const renderTime = performance.now() - startTime;
        
        // Forms should render in less than 100ms
        expect(renderTime).toBeLessThan(100);
        
        unmount();
      }
    });

    it('handles rapid breakpoint changes without errors', async () => {
      const { rerender } = renderResponsive(
        <MantineMedicationForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onInputChange={mockOnInputChange}
          formData={{}}
          practitionersOptions={mockPractitioners}
        />,
        { viewport: TEST_VIEWPORTS.desktop }
      );

      // Rapidly switch between breakpoints
      const viewports = [
        TEST_VIEWPORTS.mobile,
        TEST_VIEWPORTS.tablet,
        TEST_VIEWPORTS.desktop,
        TEST_VIEWPORTS.mobile
      ];

      for (const viewport of viewports) {
        mockViewport(viewport.width, viewport.height);
        rerender(<MantineMedicationForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onInputChange={mockOnInputChange}
          formData={{}}
          practitionersOptions={mockPractitioners}
        />);

        // Form should still be functional
        expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save|submit/i })).toBeInTheDocument();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles form submission errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmitWithError = vi.fn().mockRejectedValue(new Error('Submission failed'));
      
      renderResponsive(
        <MantineMedicationForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmitWithError}
          onInputChange={mockOnInputChange}
          formData={{}}
          practitionersOptions={mockPractitioners}
        />,
        { viewport: TEST_VIEWPORTS.mobile }
      );

      // Fill required fields
      await user.type(screen.getByRole('textbox', { name: /medication.*name/i }), 'Test Med');
      await user.type(screen.getByRole('textbox', { name: /dosage/i }), '10mg');

      // Submit form
      await user.click(screen.getByRole('button', { name: /save|submit/i }));

      // Should handle error without crashing
      await waitFor(() => {
        expect(mockOnSubmitWithError).toHaveBeenCalled();
      });

      // Form should still be rendered and usable
      expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
    });

    it('handles missing options data gracefully', async () => {
      // Test with no practitioners options
      renderResponsive(
        <MantineMedicationForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onInputChange={mockOnInputChange}
          formData={{}}
          practitionersOptions={[]}
          practitionersLoading={false}
        />,
        { viewport: TEST_VIEWPORTS.tablet }
      );

      // Form should still render
      expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
      
      // Practitioner select should show "no options" state
      const practitionerSelect = screen.getByRole('combobox', { name: /practitioner/i });
      expect(practitionerSelect).toBeInTheDocument();
    });
  });
});
