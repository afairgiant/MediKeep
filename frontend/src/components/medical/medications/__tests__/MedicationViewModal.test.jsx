import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import MedicationViewModal from '../MedicationViewModal';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: date => {
      if (!date) return null;
      const d = new Date(date + 'T00:00:00');
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
  }),
}));

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));

vi.mock('../../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));
vi.mock('../MedicationTreatmentsList', () => ({ default: () => null }));
vi.mock('../../MedicationRelationships', () => ({ default: () => null }));
vi.mock('../../StatusBadge', () => ({
  default: ({ status }) => <span>{status}</span>,
}));
vi.mock('../../../common/ClickableTagBadge', () => ({
  ClickableTagBadge: ({ children }) => <span>{children}</span>,
}));

const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('MedicationViewModal - alternative_name', () => {
  const baseMedication = {
    id: 1,
    medication_name: 'Acetaminophen',
    alternative_name: null,
    medication_type: 'otc',
    dosage: '500mg',
    frequency: 'every 6 hours',
    route: 'oral',
    indication: 'Pain relief',
    status: 'active',
    effective_period_start: null,
    effective_period_end: null,
    tags: [],
    practitioner: null,
    pharmacy: null,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    medication: baseMedication,
    onEdit: vi.fn(),
    navigate: vi.fn(),
    onError: vi.fn(),
    onFileUploadComplete: vi.fn(),
    practitioners: [],
    conditions: [],
  };

  it('renders alternative name when present', () => {
    const medication = { ...baseMedication, alternative_name: 'Paracetamol' };
    render(
      <MantineWrapper>
        <MedicationViewModal {...defaultProps} medication={medication} />
      </MantineWrapper>
    );

    expect(screen.getByText('Alternative Name')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
  });

  it('shows not specified when alternative name is absent', () => {
    render(
      <MantineWrapper>
        <MedicationViewModal {...defaultProps} />
      </MantineWrapper>
    );

    expect(screen.getByText('Alternative Name')).toBeInTheDocument();
    // Multiple fields show "Not specified" when null — verify at least one is present
    expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
  });

  it('renders medication name correctly', () => {
    render(
      <MantineWrapper>
        <MedicationViewModal {...defaultProps} />
      </MantineWrapper>
    );

    expect(screen.getByText('Medication Name')).toBeInTheDocument();
    // "Acetaminophen" appears in both the modal title header and the field value
    expect(screen.getAllByText('Acetaminophen').length).toBeGreaterThan(0);
  });
});
