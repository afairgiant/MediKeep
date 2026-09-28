import { vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import ExportPage from './ExportPage';
import { exportService } from '../services/exportService';

// Regression test for #1050 / #1051: scope labels must render as the
// human-readable text the backend provides (e.g. "Immunizations"), not as
// an unresolved i18n key (e.g. "exportPage.scopes.immunizations").

vi.mock('../services/exportService', () => ({
  exportService: {
    getSummary: vi.fn(),
    getSupportedFormats: vi.fn(),
    downloadExport: vi.fn(),
    downloadBulkExport: vi.fn(),
    validateExportParams: vi.fn(() => ({ isValid: true, errors: [] })),
  },
}));

vi.mock('../contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ unitSystem: 'imperial' }),
}));

vi.mock('../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));

const SCOPES = [
  { value: 'all', label: 'All Records', description: 'Complete medical history' },
  { value: 'allergies', label: 'Allergies', description: 'Known allergies' },
  { value: 'immunizations', label: 'Immunizations', description: 'Vaccination records' },
];

function renderExportPage() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <ExportPage />
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('ExportPage scope labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportService.getSummary.mockResolvedValue({ data: { counts: {} } });
    exportService.getSupportedFormats.mockResolvedValue({
      formats: [{ value: 'json', label: 'JSON', description: 'JSON export' }],
      scopes: SCOPES,
    });
  });

  it('renders human-readable scope labels in the single-export dropdown, not raw i18n keys', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    const scopeSelect = await screen.findByPlaceholderText(
      'export.configuration.dataToExport.placeholder'
    );
    await userEvent.click(scopeSelect);

    expect(
      await screen.findByText('Immunizations (0 records)')
    ).toBeInTheDocument();
    expect(screen.getByText('Allergies (0 records)')).toBeInTheDocument();

    expect(
      screen.queryByText(/exportPage\.scopes\./)
    ).not.toBeInTheDocument();
  });

  it('renders human-readable scope labels in the bulk export checkbox list', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(
      screen.getByText('export.exportMode.bulkExport')
    );

    const bulkSection = screen
      .getByText('export.configuration.bulkSelection.label')
      .closest('div');

    expect(
      within(bulkSection).getByText(/Immunizations \(0\)/)
    ).toBeInTheDocument();
    expect(
      within(bulkSection).queryByText(/exportPage\.scopes\./)
    ).not.toBeInTheDocument();
  });
});
