/**
 * Timezone regression tests for the Symptoms page date auto-fills.
 *
 * Three fields default to "today": the new-symptom first occurrence date, the
 * new-occurrence date, and the resolved date that appears when status becomes
 * "resolved". All three previously used
 * `new Date().toISOString().split('T')[0]`, which yields the *UTC* calendar
 * date. For users west of UTC that auto-filled tomorrow's date during evening
 * hours, which then failed "cannot be in the future" validation and made it
 * impossible to save.
 *
 * Vitest workers resolve the timezone once at startup, so it cannot be switched
 * mid-run. Instead the clock is pinned with the *local-time* Date constructor,
 * making the expected calendar date identical in every timezone while the hour
 * is chosen so local and UTC genuinely disagree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, children }) => i18nKey || children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
import { BrowserRouter } from 'react-router-dom';

const { mockGetAll, stablePatientData, viewingSymptom } = vi.hoisted(() => ({
  mockGetAll: vi.fn(() => Promise.resolve([])),
  stablePatientData: {
    patient: { patient: { id: 1, first_name: 'John', last_name: 'Doe' } },
    practitioners: { practitioners: [] },
    pharmacies: { pharmacies: [] },
  },
  viewingSymptom: { id: 7, symptom_name: 'dysesthesia neuropathy' },
}));

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
  useCurrentPatient: () => ({
    patient: { id: 1, owner_user_id: 1, permission_level: 'full' },
    loading: false,
  }),
}));

vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    isOwner: true,
    permissionLevel: 'full',
    canCreate: true,
    canEdit: true,
    canDelete: true,
    isViewOnly: false,
    viewOnlyTooltip: undefined,
  }),
}));

// Report the view modal as open so its onLogEpisode wiring is reachable.
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation: () => ({
    isOpen: true,
    viewingItem: viewingSymptom,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: d => d || '' }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@mantine/core', () => ({
  MantineProvider: ({ children }) => <div>{children}</div>,
  Container: ({ children }) => <div>{children}</div>,
  Paper: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  Stack: ({ children }) => <div>{children}</div>,
  Alert: ({ children }) => <div>{children}</div>,
  Tabs: Object.assign(({ children }) => <div>{children}</div>, {
    List: ({ children }) => <div>{children}</div>,
    Tab: ({ children, value }) => (
      <button data-value={value}>{children}</button>
    ),
    Panel: ({ children }) => <div>{children}</div>,
  }),
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Group: ({ children }) => <div>{children}</div>,
  createTheme: () => ({}),
  useMantineColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: vi.fn(),
  }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconStethoscope: props => <span {...props} />,
  IconPlus: props => <span {...props} />,
  IconTrash: props => <span {...props} />,
  IconTimeline: props => <span {...props} />,
  IconCalendar: props => <span {...props} />,
  IconList: props => <span {...props} />,
  IconEye: props => <span {...props} />,
  IconNote: props => <span {...props} />,
  IconEdit: props => <span {...props} />,
}));

/**
 * Surfaces the symptom form state and lets tests drive onInputChange the same
 * way the real Mantine Select/DateInput controls do.
 */
vi.mock('../../../components/medical/MantineSymptomForm', () => ({
  default: ({ isOpen, formData, onInputChange }) => {
    if (!isOpen) return null;
    const change = (name, value) =>
      onInputChange({ target: { name, value, type: 'text' } });
    return (
      <div data-testid="symptom-form">
        <span data-testid="first-occurrence-date">
          {formData.first_occurrence_date}
        </span>
        <span data-testid="resolved-date">{formData.resolved_date}</span>
        <button
          data-testid="status-resolved"
          onClick={() => change('status', 'resolved')}
        />
        <button
          data-testid="status-active"
          onClick={() => change('status', 'active')}
        />
        <button
          data-testid="type-resolved-date"
          onClick={() => change('resolved_date', '2026-07-01')}
        />
      </div>
    );
  },
}));

vi.mock('../../../components/medical/MantineSymptomOccurrenceForm', () => ({
  default: ({ isOpen, formData }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="occurrence-form">
        <span data-testid="occurrence-date">{formData.occurrence_date}</span>
      </div>
    );
  },
}));

vi.mock('../../../components/medical/SymptomTimeline', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/medical/SymptomCalendar', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/medical/symptoms', () => ({
  SymptomViewModal: ({ isOpen, symptom, onLogEpisode }) =>
    isOpen ? (
      <button
        data-testid="log-episode-btn"
        onClick={() => onLogEpisode(symptom)}
      />
    ) : null,
}));

vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/shared/MedicalPageAlerts', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/shared/MedicalPageActions', () => ({
  default: ({ primaryAction }) => (
    <div>
      {primaryAction && (
        <button onClick={primaryAction.onClick} data-testid="add-symptom-btn" />
      )}
    </div>
  ),
}));

vi.mock('../../../components', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../../constants/symptomEnums', () => ({
  SYMPTOM_STATUS_COLORS: {
    active: 'green',
    resolved: 'gray',
    recurring: 'orange',
    monitoring: 'blue',
  },
}));

import Symptoms from '../Symptoms';

/** Minutes UTC is ahead of local time; positive west of UTC (e.g. 420 for PDT). */
const UTC_OFFSET_MINUTES = new Date(2026, 6, 30).getTimezoneOffset();
const IS_EAST_OF_UTC = UTC_OFFSET_MINUTES < 0;
const DIVERGES_FROM_UTC = UTC_OFFSET_MINUTES !== 0;

/**
 * Local Thu 2026-07-30 at whichever edge of the day puts the UTC clock on a
 * different calendar date than the user's own.
 */
const DIVERGENT_INSTANT = IS_EAST_OF_UTC
  ? new Date(2026, 6, 30, 0, 30, 0)
  : new Date(2026, 6, 30, 23, 30, 0);

const EXPECTED_LOCAL_DATE = '2026-07-30';

async function renderAndWait() {
  render(
    <BrowserRouter>
      <Symptoms />
    </BrowserRouter>
  );
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('Symptoms page - date auto-fill uses the local date, not UTC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockImplementation(() => Promise.resolve([]));
    // Fake only Date so real timers keep driving React's async effects.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DIVERGENT_INSTANT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms the pinned clock actually straddles the date line', () => {
    // Precondition for the assertions below. Skipped only when CI runs in UTC,
    // where no local/UTC divergence is possible.
    if (!DIVERGES_FROM_UTC) return;
    expect(new Date().toISOString().split('T')[0]).not.toBe(
      EXPECTED_LOCAL_DATE
    );
  });

  it('defaults a new symptom first occurrence date to the local date', async () => {
    await renderAndWait();

    fireEvent.click(screen.getByTestId('add-symptom-btn'));

    expect(screen.getByTestId('first-occurrence-date')).toHaveTextContent(
      EXPECTED_LOCAL_DATE
    );
  });

  it('auto-fills the resolved date with the local date when status becomes resolved', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByTestId('add-symptom-btn'));

    fireEvent.click(screen.getByTestId('status-resolved'));

    expect(screen.getByTestId('resolved-date')).toHaveTextContent(
      EXPECTED_LOCAL_DATE
    );
  });

  it('does not auto-fill a resolved date the user already entered', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByTestId('add-symptom-btn'));

    fireEvent.click(screen.getByTestId('type-resolved-date'));
    fireEvent.click(screen.getByTestId('status-resolved'));

    expect(screen.getByTestId('resolved-date')).toHaveTextContent('2026-07-01');
  });

  it('clears the resolved date when status moves away from resolved', async () => {
    await renderAndWait();
    fireEvent.click(screen.getByTestId('add-symptom-btn'));
    fireEvent.click(screen.getByTestId('status-resolved'));

    fireEvent.click(screen.getByTestId('status-active'));

    expect(screen.getByTestId('resolved-date')).toBeEmptyDOMElement();
  });

  it('defaults a newly logged episode to the local date', async () => {
    await renderAndWait();

    fireEvent.click(screen.getByTestId('log-episode-btn'));

    expect(screen.getByTestId('occurrence-date')).toHaveTextContent(
      EXPECTED_LOCAL_DATE
    );
  });
});
