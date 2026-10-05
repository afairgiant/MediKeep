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

// Override the global react-i18next mock (see setupTests.js) with one that also
// resolves the `_one`/`_other` plural-suffix convention real i18next uses for a
// `{ count }` option, so tests can verify singular vs. plural selection. Wrapped
// in a spy so tests can also assert on which key was actually looked up.
const mockT = vi.hoisted(() =>
  vi.fn((key, defaultValueOrOptions, options) => {
    let vars = {};
    let text;

    if (typeof defaultValueOrOptions === 'string') {
      text = defaultValueOrOptions;
      if (typeof options === 'object') vars = options;
    } else if (
      typeof defaultValueOrOptions === 'object' &&
      defaultValueOrOptions !== null
    ) {
      vars = defaultValueOrOptions;
      const resolvedKey =
        typeof vars.count === 'number'
          ? `${key}_${vars.count === 1 ? 'one' : 'other'}`
          : key;
      text = vars.defaultValue || resolvedKey;
    } else {
      text = key;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
      vars[name] !== undefined ? String(vars[name]) : match
    );
  })
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

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
  { value: 'encounters', label: 'Encounters', description: 'Medical visits and consultations' },
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

    expect(await screen.findByText(/Immunizations \(/)).toBeInTheDocument();
    expect(screen.getByText(/Allergies \(/)).toBeInTheDocument();

    expect(
      screen.queryByText(/exportPage\.scopes\./)
    ).not.toBeInTheDocument();
  });

  it('localizes the record count and picks the singular/plural form based on count', async () => {
    exportService.getSummary.mockResolvedValue({
      data: { counts: { immunizations: 1, allergies: 2 } },
    });
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    const scopeSelect = await screen.findByPlaceholderText(
      'export.configuration.dataToExport.placeholder'
    );
    await userEvent.click(scopeSelect);

    // The count text is built via t('categories.recordCount', { count }),
    // which real i18next resolves to the `_one`/`_other` locale-specific
    // string based on count. This asserts the code selects the correct
    // suffix (and thus the correct plural form) rather than hardcoding
    // a single English word for every count, e.g. "(1 records)".
    expect(
      await screen.findByText('Immunizations (categories.recordCount_one)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Allergies (categories.recordCount_other)')
    ).toBeInTheDocument();
  });

  it('renders human-readable scope labels in the bulk export checkbox list', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(
      screen.getByText('export.exportMode.bulkExport')
    );

    const bulkSection = screen.getByTestId('bulk-scope-selection');

    expect(
      within(bulkSection).getByText(/Immunizations \(/)
    ).toBeInTheDocument();
    expect(
      within(bulkSection).queryByText(/exportPage\.scopes\./)
    ).not.toBeInTheDocument();
  });

  it('localizes the record count and picks the singular/plural form in the bulk export checkbox list', async () => {
    exportService.getSummary.mockResolvedValue({
      data: { counts: { immunizations: 1, allergies: 2 } },
    });
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(screen.getByText('export.exportMode.bulkExport'));

    const bulkSection = screen.getByTestId('bulk-scope-selection');

    expect(
      within(bulkSection).getByText(
        'Immunizations (categories.recordCount_one)'
      )
    ).toBeInTheDocument();
    expect(
      within(bulkSection).getByText(
        'Allergies (categories.recordCount_other)'
      )
    ).toBeInTheDocument();
  });

  it('sorts data types alphabetically by localized label in single and bulk lists', async () => {
    exportService.getSupportedFormats.mockResolvedValue({
      formats: [{ value: 'json', label: 'JSON', description: 'JSON export' }],
      scopes: [
        { value: 'all', label: 'All Records', description: 'x' },
        { value: 'vitals', label: 'Vital Signs', description: 'x' },
        { value: 'allergies', label: 'Allergies', description: 'x' },
        { value: 'medications', label: 'Medications', description: 'x' },
        { value: 'conditions', label: 'Medical Conditions', description: 'x' },
      ],
    });
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(screen.getByText('export.exportMode.bulkExport'));

    const bulkSection = screen.getByTestId('bulk-scope-selection');
    const labels = within(bulkSection)
      .getAllByRole('checkbox')
      .map(cb => cb.closest('.mantine-Checkbox-root').textContent);

    expect(labels.map(l => l.replace(/ \(.*$/, ''))).toEqual([
      'Allergies',
      'Medical Conditions',
      'Medications',
      'Vital Signs',
    ]);
  });

  it('selects every data type when "select all" is clicked', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(screen.getByText('export.exportMode.bulkExport'));

    const bulkSection = screen.getByTestId('bulk-scope-selection');
    const allergiesCheckbox = within(bulkSection).getByRole('checkbox', {
      name: /Allergies/,
    });
    const immunizationsCheckbox = within(bulkSection).getByRole('checkbox', {
      name: /Immunizations/,
    });
    expect(allergiesCheckbox).not.toBeChecked();
    expect(immunizationsCheckbox).not.toBeChecked();

    await userEvent.click(
      within(bulkSection).getByRole('button', {
        name: 'builder.buttons.selectAll',
      })
    );

    expect(allergiesCheckbox).toBeChecked();
    expect(immunizationsCheckbox).toBeChecked();
  });

  it('clears every data type when "clear selections" is clicked', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    await userEvent.click(screen.getByText('export.exportMode.bulkExport'));

    const bulkSection = screen.getByTestId('bulk-scope-selection');
    await userEvent.click(
      within(bulkSection).getByRole('button', {
        name: 'builder.buttons.selectAll',
      })
    );
    const allergiesCheckbox = within(bulkSection).getByRole('checkbox', {
      name: /Allergies/,
    });
    const immunizationsCheckbox = within(bulkSection).getByRole('checkbox', {
      name: /Immunizations/,
    });
    expect(allergiesCheckbox).toBeChecked();
    expect(immunizationsCheckbox).toBeChecked();

    await userEvent.click(
      within(bulkSection).getByRole('button', {
        name: 'builder.buttons.clearSelections',
      })
    );

    expect(allergiesCheckbox).not.toBeChecked();
    expect(immunizationsCheckbox).not.toBeChecked();
  });

  it('looks up the "encounters" scope under the shared:categories.visit_history key', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    const scopeSelect = await screen.findByPlaceholderText(
      'export.configuration.dataToExport.placeholder'
    );
    await userEvent.click(scopeSelect);

    await screen.findByText(/Encounters \(/);

    expect(mockT).toHaveBeenCalledWith(
      'shared:categories.visit_history',
      'Encounters'
    );
    expect(mockT).not.toHaveBeenCalledWith(
      'shared:categories.encounters',
      expect.anything()
    );
  });

  it('builds the "Export as" button text from the localized scope name, not the raw scope value', async () => {
    renderExportPage();

    await waitFor(() =>
      expect(exportService.getSupportedFormats).toHaveBeenCalled()
    );

    const scopeSelect = await screen.findByPlaceholderText(
      'export.configuration.dataToExport.placeholder'
    );
    await userEvent.click(scopeSelect);
    await userEvent.click(await screen.findByText(/Immunizations \(/));

    await waitFor(() =>
      expect(mockT).toHaveBeenCalledWith(
        'export.buttons.exportAs',
        expect.objectContaining({ scope: 'Immunizations' })
      )
    );
    expect(mockT).not.toHaveBeenCalledWith(
      'export.buttons.exportAs',
      expect.objectContaining({ scope: 'immunizations' })
    );
  });
});
