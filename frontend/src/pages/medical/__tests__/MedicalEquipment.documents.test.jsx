import { vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
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
});
