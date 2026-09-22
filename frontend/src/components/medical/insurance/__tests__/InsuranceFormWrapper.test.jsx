import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import InsuranceFormWrapper from '../InsuranceFormWrapper';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: () => null,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));

vi.mock('../../../shared/FormLoadingOverlay', () => ({ default: () => null }));

vi.mock('../../practitioners/PractitionerSelectWithCreate', () => ({
  default: () => null,
}));

const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('InsuranceFormWrapper - currency fields', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Edit Insurance',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    editingItem: { id: 1 },
    practitioners: [],
  };

  test('shows a $ prefix on a currency NumberInput (copay_primary_care)', () => {
    const formData = {
      insurance_type: 'medical',
      company_name: 'Acme',
      member_name: 'Jane Doe',
      member_id: 'M1',
      effective_date: '2024-01-01',
      status: 'active',
      copay_primary_care: 25,
    };

    render(
      <MantineWrapper>
        <InsuranceFormWrapper {...baseProps} formData={formData} />
      </MantineWrapper>
    );

    expect(screen.getByDisplayValue('$25')).toBeInTheDocument();
  });

  test('does not add a $ prefix on a non-currency NumberInput (preventive_coverage)', () => {
    const formData = {
      insurance_type: 'dental',
      company_name: 'Acme',
      member_name: 'Jane Doe',
      member_id: 'M1',
      effective_date: '2024-01-01',
      status: 'active',
      preventive_coverage: 100,
    };

    render(
      <MantineWrapper>
        <InsuranceFormWrapper {...baseProps} formData={formData} />
      </MantineWrapper>
    );

    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('$100')).not.toBeInTheDocument();
  });
});
