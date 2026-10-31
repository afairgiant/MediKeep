import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import render, { screen } from '../../../test-utils/render';
import PatientSelector from '../PatientSelector';

const { patient } = vi.hoisted(() => ({
  patient: {
    id: 1,
    first_name: 'Ada',
    last_name: 'Tester',
    birth_date: '1985-05-05',
    owner_user_id: 1,
    is_self_record: true,
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientList: () => ({
    patientList: [patient],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useCacheManager: () => ({ invalidatePatientList: vi.fn() }),
}));

vi.mock('../../../services/api/patientApi', () => ({
  default: {
    getActivePatient: vi.fn().mockResolvedValue(patient),
    getPhotoUrl: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../services/api/patientSharingApi', () => ({
  default: { getSharingStats: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../PatientForm', () => ({
  default: () => <div data-testid="patient-form" />,
}));

vi.mock('../PatientSharingModal', () => ({ default: () => null }));

describe('PatientSelector minimized view', () => {
  it('opens the create patient modal from the switch menu', async () => {
    const user = userEvent.setup();
    render(<PatientSelector compact={true} />);

    await user.click(await screen.findByLabelText('Switch patient'));
    await user.click(await screen.findByText('Add New Patient'));

    expect(await screen.findByTestId('patient-form')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Expand patient selector')
    ).toBeInTheDocument();
  });
});
