import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LabResultFormWrapper from '../LabResultFormWrapper';

// Paths are relative to this test file (src/components/medical/labresults/__tests__/)

vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: ({
    value,
    onChange,
    label,
    placeholder,
  }: {
    value: string | null;
    onChange: (_v: string | null) => void;
    label: string;
    placeholder?: string;
  }) => (
    <div data-testid="practitioner-select-with-create">
      <label htmlFor="mock-practitioner-select">{label}</label>
      <select
        id="mock-practitioner-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={placeholder}
      >
        <option value="">--</option>
        <option value="1">Dr. Smith - Internal Medicine</option>
      </select>
    </div>
  ),
}));

vi.mock('../InlineTestComponentEntry', () => ({
  default: ({ onRef }) => {
    if (onRef) onRef({ getComponents: () => [] });
    return <div data-testid="inline-test-component" />;
  },
}));
vi.mock('../TestComponentsTab', () => ({
  default: () => <div data-testid="test-components-tab" />,
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));
vi.mock('../../ConditionRelationships', () => ({
  default: () => <div data-testid="condition-relationships" />,
}));
vi.mock('../LabResultEncounterRelationships', () => ({
  default: () => <div data-testid="encounter-relationships" />,
}));
vi.mock('../LabResultMedicationRelationships', () => ({
  default: () => <div data-testid="medication-relationships" />,
}));
vi.mock('../LabResultProcedureRelationships', () => ({
  default: () => <div data-testid="procedure-relationships" />,
}));
vi.mock('../LabResultTreatmentRelationships', () => ({
  default: () => <div data-testid="treatment-relationships" />,
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: s => new Date(s),
  }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));


const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add Lab Result',
  formData: {
    test_name: '',
    test_code: '',
    test_category: '',
    test_type: '',
    facility: '',
    practitioner_id: '',
    ordered_date: '',
    completed_date: '',
    status: '',
    labs_result: '',
    notes: '',
    tags: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  editingItem: null,
  practitioners: [{ id: 1, name: 'Dr. Smith', specialty: 'Internal Medicine' }],
};

describe('LabResultFormWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Info tab (default)', () => {
    test('renders the form when open', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<LabResultFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add Lab Result')).not.toBeInTheDocument();
    });

    test('shows Ordered Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Basic Info is the default active tab — dates must be immediately visible
      expect(screen.getByText('shared:labels.orderedDate')).toBeInTheDocument();
    });

    test('shows Completed Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.getByText('shared:labels.completedDate')
      ).toBeInTheDocument();
    });

    test('renders PractitionerSelectWithCreate for the practitioner field', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.getByTestId('practitioner-select-with-create')).toBeInTheDocument();
    });

    test('shows Tags field on the Basic Info tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Use getAllByText since "tags" may appear in multiple places (e.g. navigation)
      const tagLabels = screen.getAllByText('shared:labels.tags');
      expect(tagLabels.length).toBeGreaterThan(0);
    });

    test('reports a newly entered tag through onInputChange', async () => {
      const onInputChange = vi.fn();
      render(<LabResultFormWrapper {...defaultProps} onInputChange={onInputChange} />);
      const input = screen.getByPlaceholderText('common:fields.tags.placeholder');
      await userEvent.type(input, 'fasting{Enter}');
      expect(onInputChange).toHaveBeenCalledWith({
        target: { name: 'tags', value: ['fasting'] },
      });
    });

    test('shows existing tags from formData', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, tags: ['fasting', 'annual'] }}
        />
      );
      expect(screen.getByText('fasting')).toBeInTheDocument();
      expect(screen.getByText('annual')).toBeInTheDocument();
    });
  });

  describe('Completed date same-as-ordered link', () => {
    const label = 'labresults:completedDate.sameAsOrdered';

    test('is shown but inert when there is no ordered date', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper {...defaultProps} onInputChange={onInputChange} />
      );
      fireEvent.click(screen.getByText(label));
      expect(onInputChange).not.toHaveBeenCalled();
    });

    test('clicking copies the ordered date into completed date', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onInputChange={onInputChange}
          formData={{ ...defaultProps.formData, ordered_date: '2024-03-05' }}
        />
      );
      fireEvent.click(screen.getByText(label));
      expect(onInputChange).toHaveBeenCalledWith({
        target: { name: 'completed_date', value: '2024-03-05' },
      });
    });

    test('does not change completed date until clicked', () => {
      const onInputChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onInputChange={onInputChange}
          formData={{
            ...defaultProps.formData,
            ordered_date: '2024-03-05',
            completed_date: '2024-03-09',
          }}
        />
      );
      expect(onInputChange).not.toHaveBeenCalled();
    });
  });

  describe('Results & Status tab', () => {
    // Helper: find the Results & Status tab by its exact i18n key text
    function getResultsTab() {
      return screen.getByRole('tab', { name: 'labresults:tabs.resultsStatus' });
    }

    test('shows Status and Lab Result selects', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      expect(
        screen.getByText('labresults:testStatus.label')
      ).toBeInTheDocument();
      expect(screen.getByText('shared:labels.labResult')).toBeInTheDocument();
    });

    test('Ordered Date and Completed Date are not visible on Results & Status tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      // Mantine keeps all panels mounted but hides inactive ones with CSS
      const orderedLabel = screen.queryByText('shared:labels.orderedDate');
      const completedLabel = screen.queryByText('shared:labels.completedDate');
      if (orderedLabel) expect(orderedLabel).not.toBeVisible();
      if (completedLabel) expect(completedLabel).not.toBeVisible();
    });
  });

  describe('Notes tab', () => {
    test('is not shown when creating a lab result without advanced mode', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.queryByRole('tab', { name: 'shared:tabs.notes' })
      ).not.toBeInTheDocument();
    });

    test('is shown when creating a lab result with advancedCreate enabled', async () => {
      render(<LabResultFormWrapper {...defaultProps} advancedCreate />);
      const notesTab = screen.getByRole('tab', { name: 'shared:tabs.notes' });
      expect(notesTab).toBeInTheDocument();

      await userEvent.click(notesTab);
      expect(
        screen.getByText('shared:fields.additionalNotes')
      ).toBeInTheDocument();
    });

    test('is shown when editing an existing lab result', async () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
        />
      );
      const notesTab = screen.getByRole('tab', { name: 'shared:tabs.notes' });
      expect(notesTab).toBeInTheDocument();

      await userEvent.click(notesTab);
      expect(
        screen.getByText('shared:fields.additionalNotes')
      ).toBeInTheDocument();
    });
  });

  describe('Advanced mode switch', () => {
    test('is not shown when editing an existing lab result', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
          onAdvancedModeChange={vi.fn()}
        />
      );
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    test('is not shown when onAdvancedModeChange is not provided', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    test('calls onAdvancedModeChange when toggled while creating', async () => {
      const onAdvancedModeChange = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          onAdvancedModeChange={onAdvancedModeChange}
        />
      );

      const toggle = screen.getByRole('switch');
      await userEvent.click(toggle);

      expect(onAdvancedModeChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Relationships tab', () => {
    test('is not shown when creating a lab result without advanced mode', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.queryByRole('tab', { name: 'labresults:tabs.relationships' })
      ).not.toBeInTheDocument();
    });

    test('uses the pending relationships picker when creating with advancedCreate enabled', async () => {
      const conditions = [{ id: 1, diagnosis: 'Diabetes', status: 'active' }];
      render(
        <LabResultFormWrapper
          {...defaultProps}
          advancedCreate
          conditions={conditions}
        />
      );
      const relationshipsTab = screen.getByRole('tab', {
        name: 'labresults:tabs.relationships',
      });
      await userEvent.click(relationshipsTab);

      // Pending picker (create mode), not the edit-mode API-backed components
      expect(
        screen.getByText('labresults:messages.relationshipsSaveFirst')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('condition-relationships')
      ).not.toBeInTheDocument();
    });

    test('uses the API-backed relationship components when editing an existing lab result', async () => {
      const conditions = [{ id: 1, diagnosis: 'Diabetes', status: 'active' }];
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
          conditions={conditions}
        />
      );
      const relationshipsTab = screen.getByRole('tab', {
        name: 'labresults:tabs.relationships',
      });
      await userEvent.click(relationshipsTab);

      expect(screen.getByTestId('condition-relationships')).toBeInTheDocument();
      expect(
        screen.queryByText('labresults:messages.relationshipsSaveFirst')
      ).not.toBeInTheDocument();
    });

    test('exposes pending-relationship methods to the parent via onPendingRelationshipsRef', () => {
      const onPendingRelationshipsRef = vi.fn();
      render(
        <LabResultFormWrapper
          {...defaultProps}
          advancedCreate
          onPendingRelationshipsRef={onPendingRelationshipsRef}
        />
      );

      expect(onPendingRelationshipsRef).toHaveBeenCalled();
      const methods = onPendingRelationshipsRef.mock.calls.at(-1)[0];
      expect(methods.hasPendingRelationships()).toBe(false);
      expect(methods.getPendingRelationships()).toEqual({
        conditions: [],
        encounters: [],
        medications: [],
        procedures: [],
        treatments: [],
      });
    });

    test('uses the pending relationships picker for medications/procedures/treatments when creating with advancedCreate enabled', async () => {
      const medications = [{ id: 1, medication_name: 'Metformin' }];
      const procedures = [{ id: 1, procedure_name: 'Colonoscopy' }];
      const treatments = [{ id: 1, treatment_name: 'Physical Therapy' }];
      render(
        <LabResultFormWrapper
          {...defaultProps}
          advancedCreate
          medications={medications}
          procedures={procedures}
          treatments={treatments}
        />
      );
      const relationshipsTab = screen.getByRole('tab', {
        name: 'labresults:tabs.relationships',
      });
      await userEvent.click(relationshipsTab);

      expect(
        screen.queryByTestId('medication-relationships')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('procedure-relationships')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('treatment-relationships')
      ).not.toBeInTheDocument();
    });

    test('uses the API-backed medication/procedure/treatment components when editing an existing lab result', async () => {
      const medications = [{ id: 1, medication_name: 'Metformin' }];
      const procedures = [{ id: 1, procedure_name: 'Colonoscopy' }];
      const treatments = [{ id: 1, treatment_name: 'Physical Therapy' }];
      render(
        <LabResultFormWrapper
          {...defaultProps}
          editingItem={{ id: 1, test_name: 'CBC' }}
          medications={medications}
          procedures={procedures}
          treatments={treatments}
        />
      );
      const relationshipsTab = screen.getByRole('tab', {
        name: 'labresults:tabs.relationships',
      });
      await userEvent.click(relationshipsTab);

      expect(screen.getByTestId('medication-relationships')).toBeInTheDocument();
      expect(screen.getByTestId('procedure-relationships')).toBeInTheDocument();
      expect(screen.getByTestId('treatment-relationships')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    test('calls onClose when Cancel is clicked', async () => {
      const mockClose = vi.fn();
      render(<LabResultFormWrapper {...defaultProps} onClose={mockClose} />);

      // i18n keys are rendered as-is in the test environment
      const cancelButton = screen.getByRole('button', {
        name: 'shared:fields.cancel',
      });
      await userEvent.click(cancelButton);

      expect(mockClose).toHaveBeenCalled();
    });

    test('Submit button is disabled when test_name is empty', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      // Button text: "common:buttons.create shared:categories.lab_results"
      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).toBeDisabled();
    });

    test('Submit button is enabled when test_name is provided', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, test_name: 'CBC' }}
        />
      );

      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Results & Status tab — components editor visibility (#1025 follow-up)', () => {
    test('hides the Tests/components editor for a legacy result with a flat value and no components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: 50 }}
          isGroupedResult={false}
        />
      );
      // Previously always rendered here, even with zero components, as a full
      // empty-state block (icon/title/description/Add Tests button) below the
      // one flat value being edited - reads as broken/extraneous rather than
      // useful for a legacy result reached via Test Results mode's trend panel.
      expect(screen.queryByTestId('test-components-tab')).not.toBeInTheDocument();
    });

    test('hides the Tests/components editor for a legacy result with a flat labs_result and no components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, labs_result: 'abnormal' }}
          isGroupedResult={false}
        />
      );
      expect(screen.queryByTestId('test-components-tab')).not.toBeInTheDocument();
    });

    test('still shows the Tests/components editor for a new-style result with no components and no flat value yet (none added, or all deleted)', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: null, labs_result: '' }}
          isGroupedResult={false}
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });

    test('still shows the Tests/components editor when editing a result that already has components', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42 }}
          isGroupedResult
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });

    test('stays hidden for a legacy result even after the user clears the labs_result field in the live form (regression: must read the saved record, not live formData)', () => {
      // editingItem (the saved record) still has labs_result='abnormal', so
      // this is a legacy result even though the in-progress edit has cleared
      // the field and hasn't entered a value yet - the Tests section must not
      // pop in mid-edit just because the field is momentarily empty.
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, labs_result: 'abnormal' }}
          isGroupedResult={false}
          formData={{ ...defaultProps.formData, labs_result: '', value: '' }}
        />
      );
      expect(screen.queryByTestId('test-components-tab')).not.toBeInTheDocument();
    });

    test('stays visible for a new-style empty result even after the user types a value into the live form (regression: must read the saved record, not live formData)', () => {
      // editingItem (the saved record) has neither value nor labs_result, so
      // this is a new-style result with nothing added yet - typing a draft
      // value into the form must not hide the Tests section mid-edit.
      render(
        <LabResultFormWrapper
          {...defaultProps}
          title="Edit Lab Result"
          editingItem={{ id: 42, value: null, labs_result: '' }}
          isGroupedResult={false}
          formData={{ ...defaultProps.formData, value: 50 }}
        />
      );
      expect(screen.getByTestId('test-components-tab')).toBeInTheDocument();
    });
  });
});
