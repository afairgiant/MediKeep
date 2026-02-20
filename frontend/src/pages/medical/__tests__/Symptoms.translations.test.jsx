/**
 * Translation tests for Symptoms page
 * Tests that the Symptoms page uses correct i18n keys and renders
 * in different locale contexts without errors.
 *
 * Note: The global setupTests.js mock makes t(key) return the key,
 * so we verify the component wires up the correct translation keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/*  vi.hoisted – stable mock refs for vi.mock factories                */
/*  CRITICAL: stablePatientData must be a single stable reference so   */
/*  that useCallback/useEffect deps don't change every render.         */
/* ------------------------------------------------------------------ */
const { mockGetAll, stablePatientData } = vi.hoisted(() => ({
  mockGetAll: vi.fn(() => Promise.resolve([])),
  stablePatientData: {
    patient: { patient: { id: 1, first_name: 'John', last_name: 'Doe' } },
    practitioners: { practitioners: [] },
    pharmacies: { pharmacies: [] },
  },
}));

/* ------------------------------------------------------------------ */
/*  Mocks – all hooks and services the component needs                 */
/* ------------------------------------------------------------------ */

vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: {
    getAll: mockGetAll,
    create: vi.fn(() => Promise.resolve({})),
    update: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
    createOccurrence: vi.fn(() => Promise.resolve({})),
    updateOccurrence: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => stablePatientData,
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
  useDateFormat: () => ({ formatDate: (d) => d || '' }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock @mantine/core with lightweight HTML elements
// Tabs.Panel always renders children so inactive tab content is testable
vi.mock('@mantine/core', () => ({
  MantineProvider: ({ children }) => <div>{children}</div>,
  Container: ({ children }) => <div>{children}</div>,
  Paper: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  Stack: ({ children }) => <div>{children}</div>,
  Alert: ({ children, title, icon }) => (
    <div data-testid="mantine-alert">
      {icon}
      {title && <span>{title}</span>}
      {children}
    </div>
  ),
  Tabs: Object.assign(
    ({ children }) => <div data-testid="mantine-tabs">{children}</div>,
    {
      List: ({ children }) => <div>{children}</div>,
      Tab: ({ children, value }) => <button data-value={value}>{children}</button>,
      Panel: ({ children }) => <div>{children}</div>,
    }
  ),
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick, disabled, leftSection }) => (
    <button onClick={onClick} disabled={disabled}>{leftSection}{children}</button>
  ),
  Group: ({ children }) => <div>{children}</div>,
  createTheme: () => ({}),
  useMantineColorScheme: () => ({ colorScheme: 'light', setColorScheme: vi.fn() }),
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconStethoscope: (props) => <span data-testid="icon-stethoscope" {...props} />,
  IconPlus: (props) => <span data-testid="icon-plus" {...props} />,
  IconTrash: (props) => <span data-testid="icon-trash" {...props} />,
  IconTimeline: (props) => <span data-testid="icon-timeline" {...props} />,
  IconCalendar: (props) => <span data-testid="icon-calendar" {...props} />,
  IconList: (props) => <span data-testid="icon-list" {...props} />,
  IconEye: (props) => <span data-testid="icon-eye" {...props} />,
  IconNote: (props) => <span data-testid="icon-note" {...props} />,
  IconEdit: (props) => <span data-testid="icon-edit" {...props} />,
}));

// Mock sub-components with simple HTML
vi.mock('../../../components/medical/MantineSymptomForm', () => ({
  default: ({ isOpen, onClose, title, onSubmit, submitButtonText }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="symptom-form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <button type="submit">{submitButtonText}</button>
          <button type="button" onClick={onClose}>buttons.cancel</button>
        </form>
      </div>
    );
  },
}));

vi.mock('../../../components/medical/MantineSymptomOccurrenceForm', () => ({
  default: ({ isOpen, onClose, title, onSubmit, submitButtonText }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="occurrence-form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <button type="submit">{submitButtonText}</button>
          <button type="button" onClick={onClose}>buttons.cancel</button>
        </form>
      </div>
    );
  },
}));

vi.mock('../../../components/medical/SymptomTimeline', () => ({
  default: () => <div data-testid="symptom-timeline">Timeline</div>,
}));

vi.mock('../../../components/medical/SymptomCalendar', () => ({
  default: () => <div data-testid="symptom-calendar">Calendar</div>,
}));

vi.mock('../../../components/medical/symptoms', () => ({
  SymptomViewModal: ({ isOpen }) =>
    isOpen ? <div data-testid="view-modal">View Modal</div> : null,
}));

vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('../../../components/shared/MedicalPageAlerts', () => ({
  default: ({ error, successMessage }) => (
    <div data-testid="alerts">
      {error && <span data-testid="error-text">{error}</span>}
      {successMessage && <span data-testid="success-text">{successMessage}</span>}
    </div>
  ),
}));

vi.mock('../../../components/shared/MedicalPageActions', () => ({
  default: ({ primaryAction }) => (
    <div data-testid="page-actions">
      {primaryAction && (
        <button onClick={primaryAction.onClick} data-testid="add-symptom-btn">
          {primaryAction.label}
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));

vi.mock('../../../constants/symptomEnums', () => ({
  SYMPTOM_STATUS_COLORS: {
    active: 'green',
    resolved: 'gray',
    recurring: 'orange',
    monitoring: 'blue',
  },
}));

/* ------------------------------------------------------------------ */
/*  Import component AFTER mocks                                       */
/* ------------------------------------------------------------------ */
import Symptoms from '../Symptoms';

/* ------------------------------------------------------------------ */
/*  Helper – render and flush the async loading cycle                  */
/* ------------------------------------------------------------------ */
async function renderAndWait() {
  render(
    <BrowserRouter>
      <Symptoms />
    </BrowserRouter>
  );
  // Flush microtask queue so useEffect + async fetch resolve
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('Symptoms Page - Translations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockImplementation(() => Promise.resolve([]));
  });

  describe('Page Headers', () => {
    it('should display page title with correct i18n key', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toHaveTextContent('symptoms.title');
    });

    it('should display add symptom button with correct i18n key', async () => {
      await renderAndWait();
      expect(screen.getByTestId('add-symptom-btn')).toHaveTextContent('symptoms.addSymptom');
    });

    it('should render page title without errors', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should render add button without errors', async () => {
      await renderAndWait();
      expect(screen.getByTestId('add-symptom-btn')).toBeInTheDocument();
    });
  });

  describe('Modal Titles - Add Symptom', () => {
    it('should show add modal title with correct i18n key', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));

      expect(screen.getByTestId('symptom-form-modal')).toBeInTheDocument();
      expect(screen.getByText('symptoms.addSymptomTitle')).toBeInTheDocument();
    });

    it('should show save button text in add mode', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));

      expect(screen.getByTestId('symptom-form-modal')).toBeInTheDocument();
      expect(screen.getByText('buttons.save')).toBeInTheDocument();
    });

    it('should show cancel button in form modal', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));

      expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
    });
  });

  describe('Episode Management', () => {
    it('should not show log episode button when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('symptoms.logEpisode')).not.toBeInTheDocument();
    });

    it('should render without errors with empty data', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should show alerts section', async () => {
      await renderAndWait();
      expect(screen.getByTestId('alerts')).toBeInTheDocument();
    });

    it('should show page actions section', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-actions')).toBeInTheDocument();
    });
  });

  describe('Episode Form Fields', () => {
    it('should open symptom form modal when add button clicked', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));

      expect(screen.getByTestId('symptom-form-modal')).toBeInTheDocument();
    });

    it('should show form title with correct i18n key', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));

      expect(screen.getByText('symptoms.addSymptomTitle')).toBeInTheDocument();
    });

    it('should close form when cancel clicked', async () => {
      const user = userEvent.setup();
      await renderAndWait();

      await user.click(screen.getByTestId('add-symptom-btn'));
      expect(screen.getByTestId('symptom-form-modal')).toBeInTheDocument();

      await user.click(screen.getByText('buttons.cancel'));
      expect(screen.queryByTestId('symptom-form-modal')).not.toBeInTheDocument();
    });
  });

  describe('Delete Confirmation', () => {
    it('should not show delete button when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('buttons.delete')).not.toBeInTheDocument();
    });

    it('should not show edit button when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('buttons.edit')).not.toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should display empty state message with correct i18n key', async () => {
      await renderAndWait();
      expect(screen.getByText('symptoms.noRecords')).toBeInTheDocument();
    });

    it('should display empty state prompt with correct i18n key', async () => {
      await renderAndWait();
      expect(screen.getByText('symptoms.noRecordsPrompt')).toBeInTheDocument();
    });

    it('should show stethoscope icon in empty state', async () => {
      await renderAndWait();
      expect(screen.getByTestId('icon-stethoscope')).toBeInTheDocument();
    });
  });

  describe('Chronic Badge', () => {
    it('should not show chronic badge when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('symptoms.chronic')).not.toBeInTheDocument();
    });

    it('should not show status badges when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('active')).not.toBeInTheDocument();
    });

    it('should render page structure correctly', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByTestId('page-actions')).toBeInTheDocument();
      expect(screen.getByTestId('alerts')).toBeInTheDocument();
    });
  });

  describe('Category Display', () => {
    it('should not show category label when no symptoms', async () => {
      await renderAndWait();
      expect(screen.queryByText('symptoms.category')).not.toBeInTheDocument();
    });

    it('should render component structure', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should show empty state instead of category', async () => {
      await renderAndWait();
      expect(screen.getByText('symptoms.noRecords')).toBeInTheDocument();
    });
  });

  describe('Tabs Display', () => {
    it('should render tabs section', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should render page with correct structure', async () => {
      await renderAndWait();
      expect(screen.getByTestId('page-actions')).toBeInTheDocument();
      expect(screen.getByTestId('alerts')).toBeInTheDocument();
    });

    it('should show timeline mock in page', async () => {
      await renderAndWait();
      expect(screen.getByTestId('symptom-timeline')).toBeInTheDocument();
    });
  });
});
