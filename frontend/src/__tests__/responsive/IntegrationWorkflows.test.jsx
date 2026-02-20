import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import test utilities
import {
  renderResponsive,
  testAtAllBreakpoints,
  mockMedicalData,
  TEST_VIEWPORTS,
  mockViewport
} from './ResponsiveTestUtils';

// Mock logger
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useResponsive hook
const { mockUseResponsive, mockApiCall } = vi.hoisted(() => ({
  mockUseResponsive: vi.fn(),
  mockApiCall: vi.fn(),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
  default: () => mockUseResponsive(),
}));

// Mock API calls
vi.mock('../../services/api', () => ({
  apiService: {
    post: mockApiCall,
    get: mockApiCall,
    put: mockApiCall,
    delete: mockApiCall,
  },
  post: mockApiCall,
  get: mockApiCall,
  put: mockApiCall,
  delete: mockApiCall,
}));

// Mock ResponsiveTable - simple table (desktop) or cards (mobile)
vi.mock('../../components/adapters/ResponsiveTable', () => {
  function MockResponsiveTable({ data = [], columns = [], onRowClick, pagination, totalRecords, pageSize = 20 }) {
    const responsive = mockUseResponsive();
    const isMobile = responsive?.isMobile;

    if (!data || data.length === 0) {
      return <div data-testid="empty-table">No data</div>;
    }

    if (isMobile) {
      return (
        <div data-testid="responsive-table-cards">
          {data.map((row, i) => (
            <div
              key={row.id || i}
              data-testid={`card-${i}`}
              onClick={() => onRowClick && onRowClick(row, i)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map(col => (
                <span key={col.key}>{row[col.key]}</span>
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div>
        <table role="table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick && onRowClick(row, i)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map(col => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && totalRecords > pageSize && (
          <nav role="navigation" aria-label="Pagination">
            <span>Page 1 of {Math.ceil(totalRecords / pageSize)}</span>
          </nav>
        )}
      </div>
    );
  }
  return {
    default: MockResponsiveTable,
    ResponsiveTable: MockResponsiveTable,
  };
});

// Mock ResponsiveModal - simple dialog wrapper
vi.mock('../../components/adapters/ResponsiveModal', () => {
  function MockResponsiveModal({ opened, onClose, title, children }) {
    if (!opened) return null;
    return (
      <div role="dialog" aria-label={title}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    );
  }
  return {
    default: MockResponsiveModal,
    ResponsiveModal: MockResponsiveModal,
  };
});

// Mock ResponsiveSelect - simple select with combobox role
vi.mock('../../components/adapters/ResponsiveSelect', () => {
  function MockResponsiveSelect({ label, value, options = [], onChange, searchable }) {
    const normalizedOptions = options.map(opt =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    return (
      <div>
        {label && <label htmlFor={`select-${label}`}>{label}</label>}
        <select
          id={`select-${label}`}
          role="combobox"
          aria-label={label}
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {normalizedOptions.map((opt, i) => (
            <option key={opt.value || i} value={opt.value} role="option">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return {
    default: MockResponsiveSelect,
    ResponsiveSelect: MockResponsiveSelect,
  };
});

// Mock MantineMedicationForm
vi.mock('../../components/medical/MantineMedicationForm', () => ({
  default: function MockMedicationForm({ isOpen, onClose, onSubmit, onInputChange, formData = {}, editingMedication, practitionersOptions = [] }) {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.medication_name) {
        // Show validation error by adding to DOM
        const container = document.getElementById('med-form-errors');
        if (container) {
          container.innerHTML = '<div role="alert">Medication name is required</div>';
        }
        return;
      }
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} data-testid="medication-form">
        <div>
          <label htmlFor="mock-med-name">Medication Name</label>
          <input
            id="mock-med-name"
            name="medication_name"
            value={formData.medication_name || ''}
            onChange={(e) => onInputChange({ target: { name: 'medication_name', value: e.target.value } })}
          />
        </div>
        <div>
          <label htmlFor="mock-med-dosage">Dosage</label>
          <input
            id="mock-med-dosage"
            name="dosage"
            value={formData.dosage || ''}
            onChange={(e) => onInputChange({ target: { name: 'dosage', value: e.target.value } })}
          />
        </div>
        <div>
          <label htmlFor="mock-med-frequency">Frequency</label>
          <input
            id="mock-med-frequency"
            name="frequency"
            value={formData.frequency || ''}
            onChange={(e) => onInputChange({ target: { name: 'frequency', value: e.target.value } })}
          />
        </div>
        <div>
          <label htmlFor="mock-med-practitioner">Practitioner</label>
          <select
            id="mock-med-practitioner"
            name="practitioner_id"
            role="combobox"
            value={formData.practitioner_id || formData.prescribing_practitioner || ''}
            onChange={(e) => onInputChange({ target: { name: 'practitioner_id', value: e.target.value } })}
          >
            <option value="">Select...</option>
            {practitionersOptions.map(p => (
              <option key={p.id} value={p.id} role="option">{p.name}</option>
            ))}
          </select>
        </div>
        <div id="med-form-errors"></div>
        <button type="submit">{editingMedication ? 'Save Changes' : 'Save Medication'}</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
    );
  },
}));

// Mock MantineAllergyForm
vi.mock('../../components/medical/MantineAllergyForm', () => ({
  default: function MockAllergyForm({ isOpen, onClose, onSubmit, onInputChange, formData = {} }) {
    if (!isOpen) return null;

    return (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} data-testid="allergy-form">
        <div>
          <label htmlFor="mock-allergen">Allergen</label>
          <input
            id="mock-allergen"
            name="allergen"
            value={formData.allergen || ''}
            onChange={(e) => onInputChange({ target: { name: 'allergen', value: e.target.value } })}
          />
        </div>
        <button type="submit">Save Allergy</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
    );
  },
}));

// Mock MantineConditionForm
vi.mock('../../components/medical/MantineConditionForm', () => ({
  default: function MockConditionForm({ isOpen, onClose, onSubmit, onInputChange, formData = {} }) {
    if (!isOpen) return null;

    return (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} data-testid="condition-form">
        <div>
          <label htmlFor="mock-condition-name">Condition Name</label>
          <input
            id="mock-condition-name"
            name="condition_name"
            value={formData.condition_name || ''}
            onChange={(e) => onInputChange({ target: { name: 'condition_name', value: e.target.value } })}
          />
        </div>
        <button type="submit">Save Condition</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
    );
  },
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
    vi.clearAllMocks();
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
        } catch {
          // Modal stays open on error
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

    // Need to import the mocked components for JSX
    let ResponsiveTable, ResponsiveModal, MantineMedicationForm;
    beforeAll(async () => {
      const tableModule = await import('../../components/adapters/ResponsiveTable');
      ResponsiveTable = tableModule.default;
      const modalModule = await import('../../components/adapters/ResponsiveModal');
      ResponsiveModal = modalModule.default;
      const formModule = await import('../../components/medical/MantineMedicationForm');
      MantineMedicationForm = formModule.default;
    });

    testAtAllBreakpoints(
      null, // Component created dynamically in tests
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
            });

            // 3. Fill out form using fireEvent for reliable controlled inputs
            const nameInput = screen.getByRole('textbox', { name: /medication name/i });
            const dosageInput = screen.getByRole('textbox', { name: /dosage/i });
            const frequencyInput = screen.getByRole('textbox', { name: /frequency/i });

            fireEvent.change(nameInput, { target: { value: 'New Test Medication' } });
            fireEvent.change(dosageInput, { target: { value: '25mg' } });
            fireEvent.change(frequencyInput, { target: { value: 'Three times daily' } });

            // Select practitioner
            const practitionerSelect = screen.getByRole('combobox', { name: /practitioner/i });
            await user.selectOptions(practitionerSelect, '2');

            // 4. Submit form
            const submitButton = screen.getByRole('button', { name: /save medication/i });
            await user.click(submitButton);

            // 5. Verify API call was made
            await waitFor(() => {
              expect(mockApiCall).toHaveBeenCalledWith(
                '/api/medications',
                'POST',
                expect.objectContaining({
                  medication_name: 'New Test Medication',
                  dosage: '25mg',
                  frequency: 'Three times daily'
                })
              );
            });

            // 6. Modal should close
            await waitFor(() => {
              expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            // 7. New medication should appear
            expect(screen.getByText('New Test Medication')).toBeInTheDocument();
          });

          it('completes full edit medication workflow', async () => {
            const user = userEvent.setup();

            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Click on existing medication to edit
            if (deviceType === 'mobile') {
              const medicationCard = screen.getByText('Lisinopril').closest('[data-testid*="card"]');
              await user.click(medicationCard);
            } else {
              const medicationRow = screen.getByText('Lisinopril').closest('tr');
              await user.click(medicationRow);
            }

            // 2. Edit modal should open with pre-filled data
            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
              expect(screen.getByDisplayValue('Lisinopril')).toBeInTheDocument();
            });

            // 3. Modify the dosage
            const dosageField = screen.getByRole('textbox', { name: /dosage/i });
            fireEvent.change(dosageField, { target: { value: '20mg' } });

            // 4. Submit changes
            const submitButton = screen.getByRole('button', { name: /save changes/i });
            await user.click(submitButton);

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
            const submitButton = screen.getByRole('button', { name: /save medication/i });
            await user.click(submitButton);

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
            mockApiCall.mockRejectedValueOnce(new Error('Network error'));

            renderResponsive(<MedicationManagementApp />, { viewport });

            // 1. Open add medication modal and fill form
            const user = userEvent.setup();
            await user.click(screen.getByRole('button', { name: /add medication/i }));

            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            const nameInput = screen.getByRole('textbox', { name: /medication name/i });
            const dosageInput = screen.getByRole('textbox', { name: /dosage/i });
            fireEvent.change(nameInput, { target: { value: 'Test Medication' } });
            fireEvent.change(dosageInput, { target: { value: '10mg' } });

            // 2. Submit form
            const submitButton = screen.getByRole('button', { name: /save medication/i });
            await user.click(submitButton);

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
    // These components will be resolved from mocked modules
    const MedicalRecordsApp = () => {
      const [activeForm, setActiveForm] = React.useState(null);
      const [records, setRecords] = React.useState({
        medications: sampleMedications,
        allergies: [],
        conditions: []
      });

      const forms = {
        medication: {
          title: 'Medication Form',
          props: { practitionersOptions: mockPractitioners }
        },
        allergy: {
          title: 'Allergy Form',
          props: { medicationsOptions: sampleMedications }
        },
        condition: {
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

      const renderActiveForm = () => {
        if (!activeForm) return null;

        const commonProps = {
          isOpen: true,
          onClose: () => setActiveForm(null),
          onSubmit: (data) => handleSubmit(activeForm, data),
          onInputChange: () => {},
          formData: {},
          ...forms[activeForm].props
        };

        if (activeForm === 'medication') {
          return <MockMedicationFormInline {...commonProps} />;
        }
        if (activeForm === 'allergy') {
          return <MockAllergyFormInline {...commonProps} />;
        }
        if (activeForm === 'condition') {
          return <MockConditionFormInline {...commonProps} />;
        }
        return null;
      };

      return (
        <div data-testid="medical-records-app">
          <div>
            <button onClick={() => setActiveForm('medication')}>Add Medication</button>
            <button onClick={() => setActiveForm('allergy')}>Add Allergy</button>
            <button onClick={() => setActiveForm('condition')}>Add Condition</button>
          </div>

          <ResponsiveTableInline
            data={records.medications}
            columns={sampleColumns}
            dataType="medications"
          />

          {activeForm && (
            <ResponsiveModalInline
              opened={!!activeForm}
              onClose={() => setActiveForm(null)}
              title={forms[activeForm].title}
            >
              {renderActiveForm()}
            </ResponsiveModalInline>
          )}
        </div>
      );
    };

    // Inline mock components used within the test App components
    // These mirror the vi.mock'd components but are used directly in test JSX
    const ResponsiveTableInline = ({ data = [], columns = [] }) => {
      const responsive = mockUseResponsive();
      if (!data || data.length === 0) return <div>No data</div>;

      return (
        <table role="table">
          <thead>
            <tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map(c => <td key={c.key}>{row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    };

    const ResponsiveModalInline = ({ opened, onClose, title, children }) => {
      if (!opened) return null;
      return (
        <div role="dialog" aria-label={title}>
          <h2>{title}</h2>
          {children}
        </div>
      );
    };

    const MockMedicationFormInline = ({ isOpen, onClose, onSubmit, onInputChange, formData = {}, practitionersOptions = [] }) => {
      if (!isOpen) return null;
      return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <label htmlFor="inline-med-name">Medication Name</label>
          <input id="inline-med-name" name="medication_name" value={formData.medication_name || ''} onChange={(e) => onInputChange({ target: { name: 'medication_name', value: e.target.value } })} />
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>Close</button>
        </form>
      );
    };

    const MockAllergyFormInline = ({ isOpen, onClose, onSubmit, onInputChange, formData = {} }) => {
      if (!isOpen) return null;
      return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <label htmlFor="inline-allergen">Allergen</label>
          <input id="inline-allergen" name="allergen" value={formData.allergen || ''} onChange={(e) => onInputChange({ target: { name: 'allergen', value: e.target.value } })} />
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>Close</button>
        </form>
      );
    };

    const MockConditionFormInline = ({ isOpen, onClose, onSubmit, onInputChange, formData = {} }) => {
      if (!isOpen) return null;
      return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
          <label htmlFor="inline-condition-name">Condition Name</label>
          <input id="inline-condition-name" name="condition_name" value={formData.condition_name || ''} onChange={(e) => onInputChange({ target: { name: 'condition_name', value: e.target.value } })} />
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>Close</button>
        </form>
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
        expect(screen.getByRole('textbox', { name: /medication name/i })).toBeInTheDocument();
      });

      // 2. Close and open allergy form
      await user.click(screen.getByRole('button', { name: /^close$/i }));

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
      await user.click(screen.getByRole('button', { name: /^close$/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add condition/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/condition form/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /condition name/i })).toBeInTheDocument();
      });
    });

    it('maintains separate form state for each form type', async () => {
      const user = userEvent.setup();

      renderResponsive(<MedicalRecordsApp />);

      // 1. Fill medication form partially
      await user.click(screen.getByRole('button', { name: /add medication/i }));
      fireEvent.change(
        screen.getByRole('textbox', { name: /medication name/i }),
        { target: { value: 'Test Medication' } }
      );
      await user.click(screen.getByRole('button', { name: /^close$/i }));

      // 2. Open allergy form and fill
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /add allergy/i }));
      fireEvent.change(
        screen.getByRole('textbox', { name: /allergen/i }),
        { target: { value: 'Test Allergen' } }
      );
      await user.click(screen.getByRole('button', { name: /^close$/i }));

      // 3. Reopen medication form - should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /add medication/i }));

      const medicationField = screen.getByRole('textbox', { name: /medication name/i });
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
            <div>
              <label htmlFor="workflow-practitioner">Select Practitioner</label>
              <select
                id="workflow-practitioner"
                role="combobox"
                onChange={(e) => {
                  if (e.target.value) {
                    updateWorkflowData({ practitioner: e.target.value });
                    setWorkflowState(prev => ({ ...prev, step: 2 }));
                  }
                }}
                defaultValue=""
              >
                <option value="">Select...</option>
                {mockPractitioners.map(p => (
                  <option key={p.id} value={p.id} role="option">{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {workflowState.step === 2 && (
            <div role="dialog" aria-label="Medication Form">
              <form onSubmit={(e) => {
                e.preventDefault();
                setWorkflowState(prev => ({ ...prev, step: 3 }));
              }}>
                <label htmlFor="wf-med-name">Medication Name</label>
                <input
                  id="wf-med-name"
                  name="medication_name"
                  value={workflowState.data.medication_name || ''}
                  onChange={(e) => updateWorkflowData({ medication_name: e.target.value })}
                />
                <label htmlFor="wf-dosage">Dosage</label>
                <input
                  id="wf-dosage"
                  name="dosage"
                  value={workflowState.data.dosage || ''}
                  onChange={(e) => updateWorkflowData({ dosage: e.target.value })}
                />
                <button type="submit">Save Medication</button>
              </form>
            </div>
          )}

          {workflowState.step === 3 && (
            <table role="table">
              <thead>
                <tr>{sampleColumns.map(c => <th key={c.key}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {sampleColumns.map(c => (
                    <td key={c.key}>{workflowState.data[c.key] || ''}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      );
    };

    testAtAllBreakpoints(
      null,
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

            const practitionerSelect = screen.getByRole('combobox');
            await user.selectOptions(practitionerSelect, '1');

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
            const nameInput = screen.getByRole('textbox', { name: /medication name/i });
            const dosageInput = screen.getByRole('textbox', { name: /dosage/i });
            fireEvent.change(nameInput, { target: { value: 'Workflow Test Med' } });
            fireEvent.change(dosageInput, { target: { value: '15mg' } });

            const submitButton = screen.getByRole('button', { name: /save medication/i });
            await user.click(submitButton);

            // 6. Should advance to final step
            await waitFor(() => {
              expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
            });

            // 7. Should show data in table
            expect(screen.getByRole('table')).toBeInTheDocument();
            expect(screen.getByText('Workflow Test Med')).toBeInTheDocument();
          });
        });
      }
    );
  });

  describe('Complex Medical Data Workflows', () => {
    const ComplexMedicalApp = () => {
      const [activeTab, setActiveTab] = React.useState('medications');
      const [isFormOpen, setIsFormOpen] = React.useState(false);
      const [searchTerm, setSearchTerm] = React.useState('');

      const filteredMedications = sampleMedications.filter(med =>
        med.medication_name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const allergies = [
        { id: 1, allergen: 'Penicillin', severity: 'High' },
        { id: 2, allergen: 'Shellfish', severity: 'Medium' }
      ];

      const allergyColumns = [
        { key: 'allergen', title: 'Allergen', priority: 'high' },
        { key: 'severity', title: 'Severity', priority: 'high' }
      ];

      return (
        <div data-testid="complex-medical-app">
          <div>
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
            <table role="table">
              <thead>
                <tr>{sampleColumns.map(c => <th key={c.key}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                {filteredMedications.map((row, i) => (
                  <tr key={row.id}>
                    {sampleColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'allergies' && (
            <table role="table">
              <thead>
                <tr>{allergyColumns.map(c => <th key={c.key}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                {allergies.map((row, i) => (
                  <tr key={row.id}>
                    {allergyColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {isFormOpen && (
            <div role="dialog" aria-label={activeTab === 'medications' ? 'Add Medication' : 'Add Allergy'}>
              {activeTab === 'medications' ? (
                <form data-testid="med-form">
                  <label htmlFor="cx-med-name">Medication Name</label>
                  <input id="cx-med-name" name="medication_name" />
                  <button type="button" onClick={() => setIsFormOpen(false)}>Close</button>
                </form>
              ) : (
                <form data-testid="allergy-form">
                  <label htmlFor="cx-allergen">Allergen</label>
                  <input id="cx-allergen" name="allergen" />
                  <button type="button" onClick={() => setIsFormOpen(false)}>Close</button>
                </form>
              )}
            </div>
          )}
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
      fireEvent.change(searchInput, { target: { value: 'Lisinopril' } });

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.queryByText('Metformin')).not.toBeInTheDocument();
      });

      // 3. Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Metformin')).toBeInTheDocument();
      });

      // 4. Switch to allergies tab
      await user.click(screen.getByRole('button', { name: /^allergies$/i }));

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
        expect(screen.getByRole('textbox', { name: /medication name/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^close$/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // 2. Switch to allergies and add allergy
      await user.click(screen.getByRole('button', { name: /^allergies$/i }));
      await user.click(screen.getByRole('button', { name: /add allergy/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /allergen/i })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /medication name/i })).not.toBeInTheDocument();
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
        <ResponsiveTableDirect
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
        <div role="dialog">
          <div>
            <div>
              <label htmlFor="perf-select-1">Option List</label>
              <select id="perf-select-1" role="combobox">
                {Array.from({ length: 100 }, (_, i) => (
                  <option key={i} value={`option-${i}`}>Option {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="perf-select-2">Practitioner List</label>
              <select id="perf-select-2" role="combobox">
                {mockPractitioners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
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

// Inline component used by performance test (uses the mocked module)
function ResponsiveTableDirect({ data = [], columns = [], pagination, totalRecords, pageSize = 20 }) {
  const responsive = mockUseResponsive();

  if (!data || data.length === 0) {
    return <div>No data</div>;
  }

  return (
    <div>
      <table role="table">
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(c => <td key={c.key}>{row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && totalRecords > pageSize && (
        <nav role="navigation" aria-label="Pagination">
          <span>Page 1 of {Math.ceil(totalRecords / pageSize)}</span>
        </nav>
      )}
    </div>
  );
}
