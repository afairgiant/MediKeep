import { useState } from 'react';
import { vi } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { renderWithPatient } from '../../../test-utils/render';
import MedicalEquipment from '../MedicalEquipment';
import { useMedicalData } from '../../../hooks/useMedicalData';
import { apiService } from '../../../services/api';

// Files picked in the form are uploaded only after the record is saved, so the
// form (and the document manager holding the files) must stay open until then.

vi.mock('../../../hooks/useMedicalData', () => ({
  useMedicalData: vi.fn(),
}));
vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => ({ practitioners: { practitioners: [] } }),
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    isViewOnly: false,
    viewOnlyTooltip: undefined,
  }),
}));
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation: () => ({
    isOpen: false,
    viewingItem: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: d => d,
    formatLongDate: d => d,
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'xl',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));
vi.mock('../../../services/api', () => ({
  apiService: { getEntityFiles: vi.fn() },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: C => C,
}));
vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <h1>{title}</h1>,
}));
vi.mock('../../../components/medical/equipment/EquipmentViewModal', () => ({
  default: () => null,
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// What the form's document manager hands the page through onDocumentManagerRef
const documentManager = vi.hoisted(() => ({ current: null }));

vi.mock(
  '../../../components/medical/equipment/EquipmentFormWrapper',
  async () => {
    const { useEffect } = await import('react');
    const FakeEquipmentForm = ({
      isOpen,
      onClose,
      onSubmit,
      onInputChange,
      onDocumentManagerRef,
      editingEquipment,
      formError,
    }) => {
      useEffect(() => {
        if (isOpen) onDocumentManagerRef(documentManager.current);
      }, [isOpen, onDocumentManagerRef]);
      if (!isOpen) return null;
      const fill = () => {
        onInputChange({ target: { name: 'equipment_name', value: 'CPAP' } });
        onInputChange({ target: { name: 'equipment_type', value: 'cpap' } });
      };
      return (
        <form aria-label="equipment form" onSubmit={onSubmit}>
          {editingEquipment && <p>Editing {editingEquipment.id}</p>}
          {formError && <p role="alert">{formError}</p>}
          <button type="button" onClick={fill}>
            Fill
          </button>
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </form>
      );
    };
    return { default: FakeEquipmentForm };
  }
);

const VIEW_MODE_KEY = 'medikeep_viewmode_medical-equipment';

const EQUIPMENT = [
  {
    id: 1,
    patient_id: 1,
    equipment_name: 'ResMed AirSense 11',
    equipment_type: 'cpap',
    status: 'active',
    tags: [],
  },
  {
    id: 2,
    patient_id: 1,
    equipment_name: 'Folding Walker',
    equipment_type: 'walker',
    status: 'inactive',
    tags: [],
  },
];

const mockMedicalData = overrides => {
  const data = {
    items: EQUIPMENT,
    currentPatient: { id: 1 },
    loading: false,
    error: null,
    successMessage: null,
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    refreshData: vi.fn(),
    clearError: vi.fn(),
    formError: null,
    setFormError: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  };
  useMedicalData.mockReturnValue(data);
  return data;
};

const deferred = () => {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('MedicalEquipment documents', () => {
  beforeEach(() => {
    localStorage.getItem.mockImplementation(key =>
      key === VIEW_MODE_KEY ? 'cards' : null
    );
    apiService.getEntityFiles.mockResolvedValue([]);
    documentManager.current = null;
  });

  it('uploads pending files to the new equipment before closing the form', async () => {
    const upload = deferred();
    documentManager.current = {
      hasPendingFiles: () => true,
      getPendingFilesCount: () => 1,
      uploadPendingFiles: vi.fn(() => upload.promise),
    };
    const data = mockMedicalData({
      createItem: vi.fn().mockResolvedValue({ id: 42 }),
      // loading also covers a save; only listLoading may replace the form
      loading: true,
      listLoading: false,
    });

    renderWithPatient(<MedicalEquipment />);
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(documentManager.current.uploadPendingFiles).toHaveBeenCalledWith(
        42
      )
    );
    // Refreshing now would unmount the form and drop the files mid-upload
    expect(screen.getByRole('form', { name: 'equipment form' })).toBeVisible();
    expect(data.refreshData).not.toHaveBeenCalled();

    upload.resolve();

    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'equipment form' })
      ).not.toBeInTheDocument()
    );
    expect(data.refreshData).toHaveBeenCalledTimes(1);
    expect(apiService.getEntityFiles).toHaveBeenCalledWith(
      'medical-equipment',
      42
    );
  });

  it('keeps the form open when the upload fails, and lists the record once closed', async () => {
    documentManager.current = {
      hasPendingFiles: () => true,
      getPendingFilesCount: () => 1,
      uploadPendingFiles: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const data = mockMedicalData({
      createItem: vi.fn().mockResolvedValue({ id: 42 }),
    });

    renderWithPatient(<MedicalEquipment />);
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The count is refreshed once the upload attempt is over
    await waitFor(() =>
      expect(apiService.getEntityFiles).toHaveBeenCalledWith(
        'medical-equipment',
        42
      )
    );
    expect(data.refreshData).not.toHaveBeenCalled();
    expect(screen.getByRole('form', { name: 'equipment form' })).toBeVisible();

    // The equipment itself was saved, so closing the form lists it
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'equipment form' })
      ).not.toBeInTheDocument()
    );
    expect(data.refreshData).toHaveBeenCalledTimes(1);
  });

  it('saves again to the same equipment after its upload fails', async () => {
    documentManager.current = {
      hasPendingFiles: () => true,
      getPendingFilesCount: () => 1,
      uploadPendingFiles: vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(true),
    };
    const data = mockMedicalData({
      createItem: vi
        .fn()
        .mockResolvedValue({ id: 42, equipment_name: 'CPAP', tags: [] }),
      updateItem: vi.fn().mockResolvedValue({ id: 42 }),
    });

    renderWithPatient(<MedicalEquipment />);
    fireEvent.click(screen.getByRole('button', { name: /add equipment/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The form moves on to the saved equipment, keeping the queued files
    expect(await screen.findByText('Editing 42')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'equipment form' })
      ).not.toBeInTheDocument()
    );
    expect(data.createItem).toHaveBeenCalledTimes(1);
    expect(data.updateItem).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ equipment_name: 'CPAP' })
    );
    expect(documentManager.current.uploadPendingFiles.mock.calls).toEqual([
      [42],
      [42],
    ]);
    expect(data.refreshData).toHaveBeenCalledTimes(1);
  });

  it('refreshes the card file count when the edit form closes without saving', async () => {
    mockMedicalData();
    renderWithPatient(<MedicalEquipment />);
    await waitFor(() =>
      expect(apiService.getEntityFiles).toHaveBeenCalledWith(
        'medical-equipment',
        1
      )
    );

    // A file uploaded in the Edit form is attached straight away
    apiService.getEntityFiles.mockImplementation((entityType, id) =>
      Promise.resolve(id === 1 ? [{ id: 7 }] : [])
    );
    const card = screen
      .getByText('ResMed AirSense 11')
      .closest('.mantine-Card-root');
    fireEvent.click(
      within(card).getByRole('button', { name: 'shared:labels.edit' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await within(card).findByText('1 attached')).toBeInTheDocument();
  });

  it('shows the number of attached files on each card', async () => {
    mockMedicalData();
    apiService.getEntityFiles.mockImplementation((entityType, id) =>
      Promise.resolve(
        entityType === 'medical-equipment' && id === 1
          ? [{ id: 7 }, { id: 8 }]
          : []
      )
    );

    renderWithPatient(<MedicalEquipment />);

    expect(await screen.findByText('2 attached')).toBeInTheDocument();
    expect(apiService.getEntityFiles).toHaveBeenCalledWith(
      'medical-equipment',
      2
    );
  });

  describe('save errors (#1317)', () => {
    const SAVE_ERROR =
      'Equipment Name: Must be at least 2 characters (Error: VAL-422)';

    // Like the real hook, keeps formError in state so the form re-renders with it
    const mockMedicalDataWithFormError = overrides => {
      const setter = { current: null };
      const data = mockMedicalData(overrides);
      useMedicalData.mockImplementation(() => {
        const [formError, setFormError] = useState(null);
        setter.current = setFormError;
        return { ...data, formError, setFormError };
      });
      return { data, setFormError: message => setter.current(message) };
    };

    const openAddForm = () => {
      fireEvent.click(screen.getByRole('button', { name: /add equipment/i }));
      return screen.getByRole('form', { name: 'equipment form' });
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows why the save failed inside the form, with no generic toast', async () => {
      const showToast = vi.spyOn(notifications, 'show');
      const createItem = vi.fn();
      const { setFormError } = mockMedicalDataWithFormError({ createItem });
      // What useMedicalData does when the backend rejects the create
      createItem.mockImplementation(async () => {
        setFormError(SAVE_ERROR);
        return false;
      });

      renderWithPatient(<MedicalEquipment />);
      const form = openAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Fill' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await within(form).findByText(SAVE_ERROR)).toBeInTheDocument();
      // Only in the form: the page alert behind the dialog does not repeat it
      expect(screen.getAllByText(SAVE_ERROR)).toHaveLength(1);
      expect(showToast).not.toHaveBeenCalled();

      // The form stays open with what was typed, so Save can be tried again
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(createItem).toHaveBeenCalledTimes(2));
      expect(createItem).toHaveBeenLastCalledWith(
        expect.objectContaining({ equipment_name: 'CPAP' })
      );
    });

    it('shows the page form check inside the form', async () => {
      const { data } = mockMedicalDataWithFormError({ createItem: vi.fn() });

      renderWithPatient(<MedicalEquipment />);
      const form = openAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(
        await within(form).findByText('Equipment Name is required.')
      ).toBeInTheDocument();
      expect(data.setError).not.toHaveBeenCalled();
      expect(data.createItem).not.toHaveBeenCalled();
    });

    it('clears the error when the form is opened again', async () => {
      mockMedicalDataWithFormError({ createItem: vi.fn() });

      renderWithPatient(<MedicalEquipment />);
      let form = openAddForm();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await within(form).findByText('Equipment Name is required.');

      fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
      form = openAddForm();
      expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
