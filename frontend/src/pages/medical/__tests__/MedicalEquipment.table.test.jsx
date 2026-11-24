import { vi } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderWithPatient } from '../../../test-utils/render';
import MedicalEquipment from '../MedicalEquipment';
import { useMedicalData } from '../../../hooks/useMedicalData';

// Only the data source, permissions and heavy modals are mocked. The filter
// bar, sorting and table are real so the page wiring is what gets exercised.

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
const DESKTOP = {
  breakpoint: 'xl',
  deviceType: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};
const MOBILE = {
  breakpoint: 'xs',
  deviceType: 'mobile',
  isMobile: true,
  isTablet: false,
  isDesktop: false,
};
const responsiveState = vi.hoisted(() => ({ current: null }));

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => responsiveState.current,
}));
vi.mock('../../../services/api', () => ({ apiService: {} }));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: C => C,
}));
vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <h1>{title}</h1>,
}));
vi.mock('../../../components/medical/equipment/EquipmentFormWrapper', () => ({
  default: () => null,
}));
vi.mock('../../../components/medical/equipment/EquipmentViewModal', () => ({
  default: () => null,
}));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const VIEW_MODE_KEY = 'medikeep_viewmode_medical-equipment';

// localStorage is a global vi.fn() mock in setupTests, so seed it via getItem
const setStoredViewMode = mode => {
  localStorage.getItem.mockImplementation(key =>
    key === VIEW_MODE_KEY ? mode : null
  );
};

const EQUIPMENT = [
  {
    id: 1,
    patient_id: 1,
    equipment_name: 'ResMed AirSense 11',
    equipment_type: 'cpap',
    manufacturer: 'ResMed',
    model_number: 'AirSense 11',
    serial_number: 'SN-100',
    status: 'active',
    supplier: 'Apria',
    prescribed_date: '2024-01-15',
    next_service_date: '2026-01-15',
    tags: [],
  },
  {
    id: 2,
    patient_id: 1,
    equipment_name: 'Folding Walker',
    equipment_type: 'walker',
    manufacturer: 'Drive Medical',
    model_number: 'DM-22',
    serial_number: 'SN-200',
    status: 'inactive',
    supplier: 'Local Pharmacy',
    prescribed_date: '2023-05-02',
    next_service_date: null,
    tags: [],
  },
  {
    id: 3,
    patient_id: 1,
    equipment_name: 'Omron BP Monitor',
    equipment_type: 'blood_pressure_monitor',
    manufacturer: 'Omron',
    model_number: 'BP7250',
    serial_number: 'SN-300',
    status: 'active',
    supplier: 'Amazon',
    prescribed_date: '2024-09-10',
    next_service_date: null,
    tags: [],
  },
];

const mockMedicalData = items => {
  useMedicalData.mockReturnValue({
    items,
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
  });
};

const getBodyRowNames = () => {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell')[0].textContent);
};

describe('MedicalEquipment table view', () => {
  beforeEach(() => {
    responsiveState.current = DESKTOP;
    setStoredViewMode('table');
    mockMedicalData(EQUIPMENT);
  });

  it('renders equipment in a table when the table view mode is active', () => {
    renderWithPatient(<MedicalEquipment />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('ResMed AirSense 11')).toBeInTheDocument();
    expect(within(table).getByText('Folding Walker')).toBeInTheDocument();
    expect(within(table).getByText('Omron BP Monitor')).toBeInTheDocument();
    // Type column shows the human-readable label, not the stored value
    expect(within(table).getByText('CPAP Machine')).toBeInTheDocument();
    expect(
      within(table).queryByText('blood_pressure_monitor')
    ).not.toBeInTheDocument();
  });

  it('does not render a table in cards view', () => {
    setStoredViewMode('cards');

    renderWithPatient(<MedicalEquipment />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('ResMed AirSense 11')).toBeInTheDocument();
  });

  it('filters table rows using the search box', async () => {
    renderWithPatient(<MedicalEquipment />);

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'omron' },
    });

    await waitFor(() => {
      expect(getBodyRowNames()).toEqual(['Omron BP Monitor']);
    });
  });

  it('shows the empty state when search matches nothing', async () => {
    renderWithPatient(<MedicalEquipment />);

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: 'no-such-device' },
    });

    expect(await screen.findByText('No Equipment Found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('sorts the full list, not just the visible page, when a column header is clicked', () => {
    // More records than one page (default page size is 20) so a sort applied
    // after pagination would show a different set of rows than a full-list sort.
    const manyItems = Array.from({ length: 22 }, (_, i) => ({
      ...EQUIPMENT[0],
      id: i + 1,
      equipment_name: `Device ${String(i + 1).padStart(2, '0')}`,
    }));
    mockMedicalData(manyItems);

    renderWithPatient(<MedicalEquipment />);

    // Default sort is equipment_name ascending
    let names = getBodyRowNames();
    expect(names).toHaveLength(20);
    expect(names[0]).toBe('Device 01');
    expect(names[19]).toBe('Device 20');

    fireEvent.click(
      within(screen.getByRole('table')).getByText('Equipment Name')
    );

    names = getBodyRowNames();
    expect(names).toHaveLength(20);
    expect(names[0]).toBe('Device 22');
    expect(names[19]).toBe('Device 03');
  });

  it('shows the formatted equipment type in the mobile card layout', () => {
    responsiveState.current = MOBILE;

    const { container } = renderWithPatient(<MedicalEquipment />);

    const cards = container.querySelector('.medical-responsive-cards');
    expect(cards).not.toBeNull();
    expect(
      within(cards).getByText('Blood Pressure Monitor')
    ).toBeInTheDocument();
    expect(
      within(cards).queryByText('blood_pressure_monitor')
    ).not.toBeInTheDocument();
  });
});
