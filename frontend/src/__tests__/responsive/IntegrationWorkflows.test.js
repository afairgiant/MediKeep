import React from 'react';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

// Import components for integration testing
import ResponsiveTable from '../../components/adapters/ResponsiveTable';
import ResponsiveModal from '../../components/adapters/ResponsiveModal';
import ResponsiveSelect from '../../components/adapters/ResponsiveSelect';
import MantineMedicationForm from '../../components/medical/MantineMedicationForm';
import MantineAllergyForm from '../../components/medical/MantineAllergyForm';
import MantineConditionForm from '../../components/medical/MantineConditionForm';

// Import test utilities
import {
  renderResponsive,
  testAtAllBreakpoints,
  simulateFormSubmission,
  mockMedicalData,
  TEST_VIEWPORTS,
  mockViewport
} from './ResponsiveTestUtils';

import logger from '../../services/logger';

// Mock logger
jest.mock('../../services/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock useResponsive hook
const mockUseResponsive = jest.fn();
jest.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive()
}));

// Mock API calls
const mockApiCall = jest.fn();
jest.mock('../../services/api', () => ({
  post: mockApiCall,
  get: mockApiCall,
  put: mockApiCall,
  delete: mockApiCall
}));

// Sample data for integration tests
const sampleMedications = [
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
  }
];

const sampleColumns = [
  { key: 'medication_name', title: 'Medication', priority: 'high' },
  { key: 'dosage', title: 'Dosage', priority: 'high' },
  { key: 'frequency', title: 'Frequency', priority: 'medium' },
  { key: 'prescribing_practitioner', title: 'Doctor', priority: 'medium' },
  { key: 'start_date', title: 'Start Date', priority: 'low' },
  { key: 'status', title: 'Status', priority: 'high' }
];

const mockPractitioners = [
  { id: 1, name: 'Dr. Smith', specialty: 'Cardiology' },
  { id: 2, name: 'Dr. Johnson', specialty: 'Family Medicine' },
  { id: 3, name: 'Dr. Brown', specialty: 'Internal Medicine' }
];

describe('Responsive Integration Workflow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiCall.mockResolvedValue({ data: { success: true } });
    
    // Default responsive state
    mockUseResponsive.mockReturnValue({
      breakpoint: 'lg',
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1280,
      height: 720
    });
  });

  describe('Complete Medication Management Workflow', () => {
    const MedicationManagementApp = () => {
      const [medications, setMedications] = React.useState(sampleMedications);
      const [isModalOpen, setIsModalOpen] = React.useState(false);
      const [editingMedication, setEditingMedication] = React.useState(null);
      const [formData, setFormData] = React.useState({});

      const handleAddMedication = () => {
        setEditingMedication(null);
        setFormData({});
        setIsModalOpen(true);
      };

      const handleEditMedication = (medication) => {
        setEditingMedication(medication);
        setFormData(medication);
        setIsModalOpen(true);
      };

      const handleSubmit = async (data) => {
        try {
          await mockApiCall('/api/medications', 'POST', data);
          
          if (editingMedication) {
            setMedications(prev => prev.map(med => 
              med.id === editingMedication.id ? { ...med, ...data } : med
            ));
          } else {
            const newMedication = { ...data, id: Date.now() };
            setMedications(prev => [...prev, newMedication]);
          }
          
          setIsModalOpen(false);
          setFormData({});
          setEditingMedication(null);
        } catch (error) {
          console.error('Failed to save medication:', error);
        }
      };

      const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
      };

      return (
        <div data-testid="medication-management-app">
          <button onClick={handleAddMedication}>Add Medication</button>
          
          <ResponsiveTable
            data={medications}
            columns={sampleColumns}
            onRowClick={handleEditMedication}
            dataType="medications"
            medicalContext="medications"
          />
          
          <ResponsiveModal
            opened={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingMedication ? 'Edit Medication' : 'Add Medication'}
            isForm={true}
            formType="medication"
            fieldCount={8}
          >
            <MantineMedicationForm
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSubmit={handleSubmit}
              onInputChange={handleInputChange}
              formData={formData}
              editingMedication={editingMedication}
              practitionersOptions={mockPractitioners}
              practitionersLoading={false}
            />
          </ResponsiveModal>
        </div>
      );
    };

    testAtAllBreakpoints(
      <MedicationManagementApp />,
      (breakpoint, viewport) => {
        const deviceType = breakpoint === 'xs' || breakpoint === 'sm' ? 'mobile' :
                          breakpoint === 'md' ? 'tablet' : 'desktop';

        describe(`Medication Management at ${breakpoint}`, () => {
          beforeEach(() => {
            mockUseResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet',
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });
          });

          it('completes full add medication workflow', async () => {
            const user = userEvent.setup();
            
            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Click add medication button
            const addButton = screen.getByRole('button', { name: /add medication/i });
            await user.click(addButton);

            // 2. Modal should open
            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
              expect(screen.getByText(/add medication/i)).toBeInTheDocument();
            });

            // 3. Fill out form
            const newMedication = mockMedicalData.medication({
              medication_name: 'New Test Medication',
              dosage: '25mg',
              frequency: 'Three times daily',
              prescribing_practitioner: '2'
            });

            await user.type(
              screen.getByRole('textbox', { name: /medication.*name/i }), 
              newMedication.medication_name
            );
            await user.type(
              screen.getByRole('textbox', { name: /dosage/i }), 
              newMedication.dosage
            );
            await user.type(
              screen.getByRole('textbox', { name: /frequency/i }), 
              newMedication.frequency
            );

            // Select practitioner
            const practitionerSelect = screen.getByRole('combobox', { name: /practitioner/i });
            await user.click(practitionerSelect);
            await waitFor(() => {
              expect(screen.getByRole('option', { name: /dr.*johnson/i })).toBeInTheDocument();
            });
            await user.click(screen.getByRole('option', { name: /dr.*johnson/i }));

            // 4. Submit form
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // 5. Verify API call was made
            await waitFor(() => {
              expect(mockApiCall).toHaveBeenCalledWith(
                '/api/medications',
                'POST',
                expect.objectContaining({
                  medication_name: newMedication.medication_name,
                  dosage: newMedication.dosage,
                  frequency: newMedication.frequency
                })
              );
            });

            // 6. Modal should close
            await waitFor(() => {
              expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            // 7. New medication should appear in table/cards
            if (deviceType === 'mobile') {
              // Mobile shows cards
              expect(screen.getByText(newMedication.medication_name)).toBeInTheDocument();
            } else {
              // Desktop/tablet shows table
              expect(screen.getByRole('table')).toBeInTheDocument();
              expect(screen.getByText(newMedication.medication_name)).toBeInTheDocument();
            }
          });

          it('completes full edit medication workflow', async () => {
            const user = userEvent.setup();
            
            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Click on existing medication to edit
            if (deviceType === 'mobile') {
              // On mobile, click the card
              const medicationCard = screen.getByText('Lisinopril').closest('[data-testid*="card"]');
              await user.click(medicationCard);
            } else {
              // On desktop/tablet, click the table row
              const medicationRow = screen.getByText('Lisinopril').closest('tr');
              await user.click(medicationRow);
            }

            // 2. Edit modal should open with pre-filled data
            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
              expect(screen.getByText(/edit medication/i)).toBeInTheDocument();
              expect(screen.getByDisplayValue('Lisinopril')).toBeInTheDocument();
            });

            // 3. Modify the dosage
            const dosageField = screen.getByRole('textbox', { name: /dosage/i });
            await user.clear(dosageField);
            await user.type(dosageField, '20mg');

            // 4. Submit changes
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // 5. Verify API call and UI update
            await waitFor(() => {
              expect(mockApiCall).toHaveBeenCalledWith(
                '/api/medications',
                'POST',
                expect.objectContaining({
                  medication_name: 'Lisinopril',
                  dosage: '20mg'
                })
              );
            });

            await waitFor(() => {
              expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            // 6. Updated medication should show new dosage
            expect(screen.getByText('20mg')).toBeInTheDocument();
          });

          it('handles form validation errors gracefully', async () => {
            const user = userEvent.setup();
            
            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Open add medication modal
            await user.click(screen.getByRole('button', { name: /add medication/i }));

            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // 2. Try to submit empty form
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // 3. Should show validation errors
            await waitFor(() => {
              const errorMessages = screen.queryAllByRole('alert');
              expect(errorMessages.length).toBeGreaterThan(0);
            });

            // 4. API should not be called
            expect(mockApiCall).not.toHaveBeenCalled();

            // 5. Modal should remain open
            expect(screen.getByRole('dialog')).toBeInTheDocument();
          });

          it('handles API errors during submission', async () => {
            const user = userEvent.setup();
            mockApiCall.mockRejectedValueOnce(new Error('Network error'));
            
            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Open add medication modal and fill form
            await user.click(screen.getByRole('button', { name: /add medication/i }));

            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            await user.type(
              screen.getByRole('textbox', { name: /medication.*name/i }), 
              'Test Medication'
            );
            await user.type(
              screen.getByRole('textbox', { name: /dosage/i }), 
              '10mg'
            );

            // 2. Submit form
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // 3. Should handle error gracefully
            await waitFor(() => {
              expect(mockApiCall).toHaveBeenCalled();
            });

            // 4. Modal should remain open (since submission failed)
            expect(screen.getByRole('dialog')).toBeInTheDocument();
          });
        });
      }
    );
  });

  describe('Multi-Form Workflow Integration', () => {
    const MedicalRecordsApp = () => {
      const [activeForm, setActiveForm] = React.useState(null);
      const [records, setRecords] = React.useState({
        medications: sampleMedications,
        allergies: [],
        conditions: []
      });

      const forms = {
        medication: {
          component: MantineMedicationForm,
          title: 'Medication Form',
          props: { practitionersOptions: mockPractitioners }
        },
        allergy: {
          component: MantineAllergyForm,
          title: 'Allergy Form',
          props: { medicationsOptions: sampleMedications }
        },
        condition: {
          component: MantineConditionForm,
          title: 'Condition Form',
          props: {}
        }
      };

      const handleSubmit = async (formType, data) => {
        await mockApiCall(`/api/${formType}s`, 'POST', data);
        setRecords(prev => ({
          ...prev,
          [`${formType}s`]: [...prev[`${formType}s`], { ...data, id: Date.now() }]
        }));
        setActiveForm(null);
      };

      return (
        <div data-testid="medical-records-app">
          <div>
            <button onClick={() => setActiveForm('medication')}>Add Medication</button>
            <button onClick={() => setActiveForm('allergy')}>Add Allergy</button>
            <button onClick={() => setActiveForm('condition')}>Add Condition</button>
          </div>

          <ResponsiveTable
            data={records.medications}
            columns={sampleColumns}
            dataType="medications"
          />

          {activeForm && (
            <ResponsiveModal
              opened={!!activeForm}
              onClose={() => setActiveForm(null)}
              title={forms[activeForm].title}
              isForm={true}
              formType={activeForm}
            >
              {React.createElement(forms[activeForm].component, {
                isOpen: !!activeForm,
                onClose: () => setActiveForm(null),
                onSubmit: (data) => handleSubmit(activeForm, data),
                onInputChange: () => {},
                formData: {},
                ...forms[activeForm].props
              })}
            </ResponsiveModal>
          )}
        </div>
      );
    };

    it('switches between different medical forms seamlessly', async () => {
      const user = userEvent.setup();
      
      renderResponsive(<MedicalRecordsApp />);

      // 1. Open medication form
      await user.click(screen.getByRole('button', { name: /add medication/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/medication form/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
      });

      // 2. Close and open allergy form
      await user.click(screen.getByRole('button', { name: /close/i }));
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add allergy/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/allergy form/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /allergen/i })).toBeInTheDocument();
      });

      // 3. Switch to condition form
      await user.click(screen.getByRole('button', { name: /close/i }));
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add condition/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/condition form/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /condition.*name/i })).toBeInTheDocument();
      });
    });

    it('maintains separate form state for each form type', async () => {
      const user = userEvent.setup();
      
      renderResponsive(<MedicalRecordsApp />);

      // 1. Fill medication form partially
      await user.click(screen.getByRole('button', { name: /add medication/i }));
      await user.type(
        screen.getByRole('textbox', { name: /medication.*name/i }), 
        'Test Medication'
      );
      await user.click(screen.getByRole('button', { name: /close/i }));

      // 2. Open allergy form and fill
      await user.click(screen.getByRole('button', { name: /add allergy/i }));
      await user.type(
        screen.getByRole('textbox', { name: /allergen/i }), 
        'Test Allergen'
      );
      await user.click(screen.getByRole('button', { name: /close/i }));

      // 3. Reopen medication form - should be cleared
      await user.click(screen.getByRole('button', { name: /add medication/i }));
      
      const medicationField = screen.getByRole('textbox', { name: /medication.*name/i });
      expect(medicationField).toHaveValue('');
    });
  });

  describe('Cross-Device Workflow Continuity', () => {
    const WorkflowApp = () => {
      const [workflowState, setWorkflowState] = React.useState({
        step: 1,
        data: {}
      });

      const updateWorkflowData = (newData) => {
        setWorkflowState(prev => ({
          ...prev,
          data: { ...prev.data, ...newData }
        }));
      };

      return (
        <div data-testid="workflow-app">
          <div>Step {workflowState.step} of 3</div>
          
          {workflowState.step === 1 && (
            <ResponsiveSelect
              label="Select Practitioner"
              options={mockPractitioners.map(p => ({ value: p.id, label: p.name }))}
              onChange={(value) => {
                updateWorkflowData({ practitioner: value });
                setWorkflowState(prev => ({ ...prev, step: 2 }));
              }}
            />
          )}
          
          {workflowState.step === 2 && (
            <ResponsiveModal opened={true} onClose={() => {}}>
              <MantineMedicationForm
                isOpen={true}
                onClose={() => {}}
                onSubmit={(data) => {
                  updateWorkflowData(data);
                  setWorkflowState(prev => ({ ...prev, step: 3 }));
                }}
                onInputChange={() => {}}
                formData={workflowState.data}
                practitionersOptions={mockPractitioners}
              />
            </ResponsiveModal>
          )}
          
          {workflowState.step === 3 && (
            <ResponsiveTable
              data={[workflowState.data]}
              columns={sampleColumns}
              dataType="medications"
            />
          )}
        </div>
      );
    };

    testAtAllBreakpoints(
      <WorkflowApp />,
      (breakpoint, viewport) => {
        const deviceType = breakpoint === 'xs' || breakpoint === 'sm' ? 'mobile' :
                          breakpoint === 'md' ? 'tablet' : 'desktop';

        describe(`Workflow Continuity at ${breakpoint}`, () => {
          beforeEach(() => {
            mockUseResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet',
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });
          });

          it('maintains workflow state across breakpoint changes', async () => {
            const user = userEvent.setup();
            
            const { rerender } = renderResponsive(<WorkflowApp />, { viewport });

            // 1. Start workflow - select practitioner
            expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
            
            const practitionerSelect = screen.getByRole('combobox', { name: /practitioner/i });
            await user.click(practitionerSelect);
            await user.click(screen.getByRole('option', { name: /dr.*smith/i }));

            // 2. Should advance to step 2
            await waitFor(() => {
              expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
              expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // 3. Change breakpoint during form fill
            const newBreakpoint = deviceType === 'mobile' ? 'desktop' : 'mobile';
            const newDeviceType = newBreakpoint === 'desktop' ? 'desktop' : 'mobile';
            const newViewport = TEST_VIEWPORTS[newBreakpoint];
            
            mockUseResponsive.mockReturnValue({
              breakpoint: newBreakpoint,
              deviceType: newDeviceType,
              isMobile: newDeviceType === 'mobile',
              isTablet: false,
              isDesktop: newDeviceType === 'desktop',
              width: newViewport.width,
              height: newViewport.height
            });

            mockViewport(newViewport.width, newViewport.height);
            rerender(<WorkflowApp />);

            // 4. Should still be on step 2 with form open
            await waitFor(() => {
              expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
              expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // 5. Complete form
            await user.type(
              screen.getByRole('textbox', { name: /medication.*name/i }), 
              'Workflow Test Med'
            );
            await user.type(
              screen.getByRole('textbox', { name: /dosage/i }), 
              '15mg'
            );
            
            await user.click(screen.getByRole('button', { name: /save|submit/i }));

            // 6. Should advance to final step
            await waitFor(() => {
              expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
            });

            // 7. Should show data in appropriate format for new breakpoint
            if (newDeviceType === 'mobile') {
              expect(screen.queryByRole('table')).not.toBeInTheDocument();
              expect(screen.getByText('Workflow Test Med')).toBeInTheDocument();
            } else {
              expect(screen.getByRole('table')).toBeInTheDocument();
              expect(screen.getByText('Workflow Test Med')).toBeInTheDocument();
            }
          });
        });
      }
    );
  });

  describe('Complex Medical Data Workflows', () => {
    const ComplexMedicalApp = () => {
      const [selectedPatient, setSelectedPatient] = React.useState('patient-1');
      const [activeTab, setActiveTab] = React.useState('medications');
      const [isFormOpen, setIsFormOpen] = React.useState(false);
      const [searchTerm, setSearchTerm] = React.useState('');

      const patientData = {
        'patient-1': {
          medications: sampleMedications.filter(med => 
            med.medication_name.toLowerCase().includes(searchTerm.toLowerCase())
          ),
          allergies: [
            { id: 1, allergen: 'Penicillin', severity: 'High' },
            { id: 2, allergen: 'Shellfish', severity: 'Medium' }
          ]
        }
      };

      return (
        <div data-testid="complex-medical-app">
          <div>
            <ResponsiveSelect
              label="Select Patient"
              value={selectedPatient}
              options={[{ value: 'patient-1', label: 'John Doe' }]}
              onChange={setSelectedPatient}
            />
            
            <div>
              <button 
                onClick={() => setActiveTab('medications')}
                data-active={activeTab === 'medications'}
              >
                Medications
              </button>
              <button 
                onClick={() => setActiveTab('allergies')}
                data-active={activeTab === 'allergies'}
              >
                Allergies
              </button>
            </div>

            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <button onClick={() => setIsFormOpen(true)}>
              Add {activeTab === 'medications' ? 'Medication' : 'Allergy'}
            </button>
          </div>

          {activeTab === 'medications' && (
            <ResponsiveTable
              data={patientData[selectedPatient].medications}
              columns={sampleColumns}
              dataType="medications"
              searchable={true}
            />
          )}

          {activeTab === 'allergies' && (
            <ResponsiveTable
              data={patientData[selectedPatient].allergies}
              columns={[
                { key: 'allergen', title: 'Allergen', priority: 'high' },
                { key: 'severity', title: 'Severity', priority: 'high' }
              ]}
              dataType="allergies"
            />
          )}

          <ResponsiveModal
            opened={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            title={`Add ${activeTab === 'medications' ? 'Medication' : 'Allergy'}`}
            isForm={true}
            formType={activeTab === 'medications' ? 'medication' : 'allergy'}
          >
            {activeTab === 'medications' ? (
              <MantineMedicationForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={async (data) => {
                  await mockApiCall('/api/medications', 'POST', data);
                  setIsFormOpen(false);
                }}
                onInputChange={() => {}}
                formData={{}}
                practitionersOptions={mockPractitioners}
              />
            ) : (
              <MantineAllergyForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={async (data) => {
                  await mockApiCall('/api/allergies', 'POST', data);
                  setIsFormOpen(false);
                }}
                onInputChange={() => {}}
                formData={{}}
                medicationsOptions={sampleMedications}
              />
            )}
          </ResponsiveModal>
        </div>
      );
    };

    it('handles complex data filtering and searching', async () => {
      const user = userEvent.setup();
      
      renderResponsive(<ComplexMedicalApp />);

      // 1. Initial state - should show all medications
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText('Metformin')).toBeInTheDocument();

      // 2. Search for specific medication
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Lisinopril');

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.queryByText('Metformin')).not.toBeInTheDocument();
      });

      // 3. Clear search
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Metformin')).toBeInTheDocument();
      });

      // 4. Switch to allergies tab
      await user.click(screen.getByRole('button', { name: /allergies/i }));

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
        expect(screen.queryByText('Lisinopril')).not.toBeInTheDocument();
      });
    });

    it('manages form context switching correctly', async () => {
      const user = userEvent.setup();
      
      renderResponsive(<ComplexMedicalApp />);

      // 1. Add medication
      await user.click(screen.getByRole('button', { name: /add medication/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /medication.*name/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close/i }));

      // 2. Switch to allergies and add allergy
      await user.click(screen.getByRole('button', { name: /allergies/i }));
      await user.click(screen.getByRole('button', { name: /add allergy/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /allergen/i })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /medication.*name/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance Under Load Workflows', () => {
    it('handles large dataset operations efficiently', async () => {
      const largeDataset = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        medication_name: `Medication ${i}`,
        dosage: `${(i + 1) * 5}mg`,
        frequency: i % 2 === 0 ? 'Once daily' : 'Twice daily',
        prescribing_practitioner: `Dr. ${String.fromCharCode(65 + (i % 26))}`,
        start_date: '2024-01-01',
        status: i % 3 === 0 ? 'Discontinued' : 'Active'
      }));

      const startTime = performance.now();
      
      const { unmount } = renderResponsive(
        <ResponsiveTable
          data={largeDataset}
          columns={sampleColumns}
          dataType="medications"
          pagination={true}
          pageSize={50}
          totalRecords={largeDataset.length}
        />
      );
      
      const renderTime = performance.now() - startTime;
      
      // Should render large dataset within reasonable time
      expect(renderTime).toBeLessThan(500);
      
      // Should show pagination
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      unmount();
    });

    it('maintains responsiveness during rapid user interactions', async () => {
      const user = userEvent.setup();
      
      renderResponsive(
        <ResponsiveModal opened={true} onClose={() => {}}>
          <div>
            <ResponsiveSelect
              options={Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`)}
              searchable={true}
            />
            <ResponsiveSelect
              options={mockPractitioners.map(p => ({ value: p.id, label: p.name }))}
              medicalContext="practitioners"
            />
          </div>
        </ResponsiveModal>
      );

      const firstSelect = screen.getAllByRole('combobox')[0];
      const secondSelect = screen.getAllByRole('combobox')[1];

      const interactionStart = performance.now();
      
      // Rapid interactions
      for (let i = 0; i < 5; i++) {
        await user.click(firstSelect);
        await user.keyboard('{Escape}');
        await user.click(secondSelect);
        await user.keyboard('{Escape}');
      }
      
      const interactionTime = performance.now() - interactionStart;
      
      // Should handle rapid interactions smoothly
      expect(interactionTime).toBeLessThan(2000);
    });
  });
});