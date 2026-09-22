import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import InsuranceCard from '../InsuranceCard';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatLongDate: date => (date ? `formatted:${date}` : null),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
    i18n: { language: 'en' },
  }),
}));

const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('InsuranceCard', () => {
  const baseInsurance = {
    id: 1,
    insurance_type: 'medical',
    company_name: 'Acme Health',
    member_name: 'Jane Doe',
    member_id: 'M12345',
    status: 'active',
    is_primary: false,
    effective_date: '2024-01-01',
    coverage_details: {
      deductible_individual: 500,
    },
  };

  const practitioners = [
    { id: 1, name: 'Dr. Smith', specialty: 'Cardiology' },
  ];

  const defaultProps = {
    insurance: baseInsurance,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onView: vi.fn(),
    onPrint: vi.fn(),
    practitioners,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders a Print button on the same row as View/Edit/Delete', () => {
    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} />
      </MantineWrapper>
    );

    expect(screen.getByText('Print Card')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  test('calls onPrint with the insurance record, without triggering onView', async () => {
    const user = userEvent.setup();
    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} />
      </MantineWrapper>
    );

    await user.click(screen.getByText('Print Card'));

    expect(defaultProps.onPrint).toHaveBeenCalledTimes(1);
    expect(defaultProps.onView).not.toHaveBeenCalled();
  });

  test('bakes the resolved PCP name into coverage_details when printing', async () => {
    const user = userEvent.setup();
    const insuranceWithPcp = {
      ...baseInsurance,
      practitioner_id: 1,
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={insuranceWithPcp} />
      </MantineWrapper>
    );

    await user.click(screen.getByText('Print Card'));

    expect(defaultProps.onPrint).toHaveBeenCalledWith(
      expect.objectContaining({
        coverage_details: expect.objectContaining({
          primary_care_physician: 'Dr. Smith - Cardiology',
        }),
      })
    );
  });

  test('does not show Primary Care Physician on medical cards, even when linked', () => {
    // The PCP is still resolved for printing (see the test above); it's
    // just no longer displayed on the card face itself.
    const insuranceWithPcp = {
      ...baseInsurance,
      practitioner_id: 1,
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={insuranceWithPcp} />
      </MantineWrapper>
    );

    expect(
      screen.queryByText('Primary Care Physician')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Dr\. Smith/)).not.toBeInTheDocument();
  });

  test('does not throw when onPrint is not provided', async () => {
    const user = userEvent.setup();
    const { onPrint: _omit, ...propsWithoutPrint } = defaultProps;

    render(
      <MantineWrapper>
        <InsuranceCard {...propsWithoutPrint} />
      </MantineWrapper>
    );

    await expect(
      user.click(screen.getByText('Print Card'))
    ).resolves.not.toThrow();
  });

  test('no longer shows Deductible/Preventive/Basic Coverage on the card', () => {
    // Regression: these were removed from the card's "Key Coverage Details"
    // summary at the user's request (too much detail).
    const dentalInsurance = {
      ...baseInsurance,
      insurance_type: 'dental',
      coverage_details: {
        annual_maximum: 1500,
        preventive_coverage: 100,
        basic_coverage: 80,
      },
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={dentalInsurance} />
      </MantineWrapper>
    );

    expect(screen.queryByText(/Annual Max/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Preventive/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Basic/)).not.toBeInTheDocument();
  });

  test('no longer shows Exam Copay/Frame Allowance on vision cards', () => {
    const visionInsurance = {
      ...baseInsurance,
      insurance_type: 'vision',
      coverage_details: {
        exam_copay: 20,
        frame_allowance: 150,
      },
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={visionInsurance} />
      </MantineWrapper>
    );

    expect(screen.queryByText(/Exam Copay/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Frame Allowance/)).not.toBeInTheDocument();
  });

  test('prescription cards show RX Group on the line after PCN, when present', () => {
    const rxInsurance = {
      ...baseInsurance,
      insurance_type: 'prescription',
      coverage_details: {
        bin_number: '123456',
        pcn_number: 'ABCPCN',
        rxgroup: 'RXG789',
      },
    };

    const { container } = render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={rxInsurance} />
      </MantineWrapper>
    );

    expect(screen.getByText('BIN:')).toBeInTheDocument();
    expect(screen.getByText('PCN:')).toBeInTheDocument();
    expect(screen.getByText('RX Group:')).toBeInTheDocument();
    expect(screen.getByText('RXG789')).toBeInTheDocument();

    const pcnIndex = container.textContent.indexOf('PCN:');
    const rxGroupIndex = container.textContent.indexOf('RX Group:');
    expect(pcnIndex).toBeGreaterThan(-1);
    expect(rxGroupIndex).toBeGreaterThan(pcnIndex);
  });

  test('prescription cards omit RX Group when not present', () => {
    const rxInsuranceNoGroup = {
      ...baseInsurance,
      insurance_type: 'prescription',
      coverage_details: {
        bin_number: '123456',
        pcn_number: 'ABCPCN',
      },
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={rxInsuranceNoGroup} />
      </MantineWrapper>
    );

    expect(screen.getByText('BIN:')).toBeInTheDocument();
    expect(screen.getByText('PCN:')).toBeInTheDocument();
    expect(screen.queryByText(/RX Group/)).not.toBeInTheDocument();
  });

  test('no longer shows Holder on any card type, even when the policy holder differs from the member', () => {
    const withDifferentHolder = {
      ...baseInsurance,
      policy_holder_name: 'John Doe',
      relationship_to_holder: 'spouse',
    };

    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} insurance={withDifferentHolder} />
      </MantineWrapper>
    );

    expect(screen.queryByText(/Holder/)).not.toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  test('calls onView when the card body is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MantineWrapper>
        <InsuranceCard {...defaultProps} />
      </MantineWrapper>
    );

    await user.click(screen.getByText('Acme Health'));
    expect(defaultProps.onView).toHaveBeenCalledWith(baseInsurance);
  });
});
