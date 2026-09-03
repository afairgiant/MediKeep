/**
 * Regression test for #995: clearing the assigned practitioner must reach the
 * API as an explicit `physician_id: null`.
 *
 * The practitioner Select emits an empty string when cleared (see
 * useFormHandlers.handleSelectChange), and this page is the only place that
 * empty string is translated into the null the backend needs to unassign the
 * physician. That mapping had no test, so a refactor here could silently
 * reintroduce the bug even with the backend fixed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, children }) => i18nKey || children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { createMockPatient, createMockPractitioner } from '../../../test-utils/test-data';

const assignedPhysician = createMockPractitioner({ id: 2, name: 'Dr. Assigned' });
const existingPatient = createMockPatient({
  id: 4,
  physician_id: assignedPhysician.id,
  relationship_to_self: 'self',
});

const { mockUpdatePatient } = vi.hoisted(() => ({
  mockUpdatePatient: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/api/patientApi', () => ({
  default: {
    updatePatient: mockUpdatePatient,
    createPatient: vi.fn(() => Promise.resolve({})),
    getPhotoInfo: vi.fn(() => Promise.resolve(null)),
    getPhotoUrl: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  useCurrentPatient: () => ({
    patient: existingPatient,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  usePractitioners: () => ({
    practitioners: [assignedPhysician],
    loading: false,
  }),
  useCacheManager: () => ({
    invalidatePatientList: vi.fn(() => Promise.resolve()),
    invalidatePatient: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../../../contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ unitSystem: 'imperial' }),
}));

vi.mock('../../../hooks/useFormSubmissionWithUploads', () => ({
  useFormSubmissionWithUploads: () => ({
    isBlocking: false,
    canSubmit: true,
    statusMessage: '',
    resetSubmission: vi.fn(),
    startSubmission: vi.fn(),
    completeFormSubmission: vi.fn(() => true),
    completeFileUpload: vi.fn(),
    handleSubmissionFailure: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatLongDate: d => d || '' }),
}));

vi.mock('../../../hooks/useViewport', () => ({
  useViewport: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@mantine/core', () => ({
  Container: ({ children }) => <div>{children}</div>,
  Stack: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  Alert: ({ children }) => <div>{children}</div>,
  Card: ({ children }) => <div>{children}</div>,
  SimpleGrid: ({ children }) => <div>{children}</div>,
  ThemeIcon: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconUser: props => <span {...props} />,
  IconStethoscope: props => <span {...props} />,
  IconPencil: props => <span {...props} />,
}));

vi.mock('../../../components', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../../components/shared/PatientAvatar', () => ({
  default: () => <div />,
}));

vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: () => <div />,
}));

/**
 * Stands in for the real form, driving onInputChange exactly as the practitioner
 * Select does: an empty string when the selection is cleared.
 */
vi.mock('../../../components/medical/patient-info/PatientFormWrapper', () => ({
  default: ({ isOpen, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="patient-form">
        <span data-testid="physician-value">{String(formData.physician_id)}</span>
        <button
          data-testid="clear-physician"
          onClick={() =>
            onInputChange({ target: { name: 'physician_id', value: '' } })
          }
        />
        <button data-testid="submit-form" onClick={() => onSubmit()} />
      </div>
    );
  },
}));

import PatientInfo from '../Patient-Info';

const renderInEditMode = () =>
  render(
    <MemoryRouter initialEntries={['/patients/me?edit=true']}>
      <PatientInfo />
    </MemoryRouter>
  );

describe('Patient-Info physician assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates the form with the currently assigned physician', async () => {
    renderInEditMode();

    expect(await screen.findByTestId('patient-form')).toBeInTheDocument();
    expect(screen.getByTestId('physician-value')).toHaveTextContent('2');
  });

  it('sends physician_id as null after the practitioner is cleared', async () => {
    renderInEditMode();

    await screen.findByTestId('patient-form');
    fireEvent.click(screen.getByTestId('clear-physician'));
    fireEvent.click(screen.getByTestId('submit-form'));

    await waitFor(() => expect(mockUpdatePatient).toHaveBeenCalled());

    const [patientId, payload] = mockUpdatePatient.mock.calls[0];
    expect(patientId).toBe(existingPatient.id);
    expect(payload).toHaveProperty('physician_id', null);
  });

  it('keeps the assignment when the practitioner is left untouched', async () => {
    renderInEditMode();

    await screen.findByTestId('patient-form');
    fireEvent.click(screen.getByTestId('submit-form'));

    await waitFor(() => expect(mockUpdatePatient).toHaveBeenCalled());

    expect(mockUpdatePatient.mock.calls[0][1]).toHaveProperty(
      'physician_id',
      existingPatient.physician_id
    );
  });
});
