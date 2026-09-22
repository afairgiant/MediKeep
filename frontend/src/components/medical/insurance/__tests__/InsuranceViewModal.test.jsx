import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import InsuranceViewModal from '../InsuranceViewModal';

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
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => null,
}));

const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('InsuranceViewModal', () => {
  const baseInsurance = {
    id: 1,
    insurance_type: 'medical',
    company_name: 'Acme Health',
    plan_name: 'Gold PPO',
    employer_group: 'Acme Corp',
    member_name: 'Jane Doe',
    member_id: 'M12345',
    policy_holder_name: 'Jane Doe',
    relationship_to_holder: 'self',
    group_number: 'GRP-001',
    practitioner_id: 1,
    effective_date: '2024-01-01',
    expiration_date: null,
    status: 'active',
    is_primary: false,
    coverage_details: {
      deductible_individual: 0,
      copay_primary_care: 25,
    },
    contact_info: {
      customer_service_phone: '555-123-4567',
      claims_address: '123 Insurance Way',
      website_url: 'https://www.acmehealth.example.com',
    },
    notes: 'Some notes here',
  };

  const practitioners = [
    { id: 1, name: 'Dr. Smith', specialty: 'Cardiology' },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    insurance: baseInsurance,
    onEdit: vi.fn(),
    practitioners,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does not render when insurance is null', () => {
    render(
      <MantineWrapper>
        <InsuranceViewModal {...defaultProps} insurance={null} />
      </MantineWrapper>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('renders company name in the header', () => {
    render(
      <MantineWrapper>
        <InsuranceViewModal {...defaultProps} />
      </MantineWrapper>
    );

    expect(screen.getAllByText('Acme Health').length).toBeGreaterThanOrEqual(
      1
    );
  });

  describe('Basic Info tab', () => {
    test('shows plan name, employer group, and group number', () => {
      // group_number lives in Basic Info (not Member), matching the
      // Add/Edit form's field grouping.
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Gold PPO')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('GRP-001')).toBeInTheDocument();
    });
  });

  describe('Member tab', () => {
    test('shows member name and member id', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      // "Jane Doe" appears twice: member_name and policy_holder_name are
      // deliberately the same value in this fixture.
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(
        1
      );
      expect(screen.getByText('M12345')).toBeInTheDocument();
    });

    test('resolves the linked Primary Care Physician (now grouped under Coverage, matching the Add/Edit form)', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Dr. Smith - Cardiology')).toBeInTheDocument();
    });
  });

  describe('Coverage tab', () => {
    test('renders a real $0 coverage value as "$0", not "Not specified"', () => {
      // Regression: the old flattening approach did `value || ''`, which
      // coerced a real 0 (e.g. a $0 deductible) into an empty string and
      // hid it behind the "Not specified" placeholder.
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(1);
    });

    test('renders a nonzero currency coverage value with a $ prefix', () => {
      // copay_primary_care is a currency field; the View dialog now shows
      // the same $ prefix Print already applies, instead of a bare number.
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('$25')).toBeInTheDocument();
    });

    test('does not add a $ prefix to a non-currency number field (percentage)', () => {
      const dentalInsurance = {
        ...baseInsurance,
        insurance_type: 'dental',
        coverage_details: { preventive_coverage: 100 },
      };

      render(
        <MantineWrapper>
          <InsuranceViewModal
            {...defaultProps}
            insurance={dentalInsurance}
          />
        </MantineWrapper>
      );

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.queryByText('$100')).not.toBeInTheDocument();
    });

    test('renders is_primary: false as "No"', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('No')).toBeInTheDocument();
    });

    test('renders a null expiration date as "Ongoing"', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Ongoing')).toBeInTheDocument();
    });
  });

  describe('Contact tab', () => {
    test('shows the real contact fields (customer service phone, claims address)', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
      expect(screen.getByText('123 Insurance Way')).toBeInTheDocument();
    });

    test('renders Website URL as a clickable link, opened in a new tab safely', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      const link = screen.getByText('www.acmehealth.example.com');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute(
        'href',
        'https://www.acmehealth.example.com'
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('shows "Not specified" for Website URL when absent, not a broken link', () => {
      const noWebsiteInsurance = {
        ...baseInsurance,
        contact_info: {
          ...baseInsurance.contact_info,
          website_url: undefined,
        },
      };

      render(
        <MantineWrapper>
          <InsuranceViewModal
            {...defaultProps}
            insurance={noWebsiteInsurance}
          />
        </MantineWrapper>
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('does not crash when website_url is a non-string value (untyped contact_info from the API)', () => {
      // Regression: contact_info is stored as an untyped Dict[str, Any] on
      // the backend, so nothing guarantees website_url is actually a
      // string. rawValue.replace(...) used to throw for a non-string
      // truthy value (e.g. a number), crashing the whole dialog render.
      const numericWebsiteInsurance = {
        ...baseInsurance,
        contact_info: {
          ...baseInsurance.contact_info,
          website_url: 12345,
        },
      };

      expect(() =>
        render(
          <MantineWrapper>
            <InsuranceViewModal
              {...defaultProps}
              insurance={numericWebsiteInsurance}
            />
          </MantineWrapper>
        )
      ).not.toThrow();

      const link = screen.getByText('12345');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '12345');
    });
  });

  describe('Notes tab', () => {
    test('shows notes text', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Some notes here')).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    test('calls onClose when Close is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      await user.click(screen.getByText('Close'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('calls onEdit with the insurance record when Edit is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      await user.click(screen.getByText('Edit'));
      expect(defaultProps.onEdit).toHaveBeenCalledWith(baseInsurance);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('no longer offers a Print action (moved to InsuranceCard)', () => {
      render(
        <MantineWrapper>
          <InsuranceViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Print Card')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    test('handles minimal insurance data (no coverage_details/contact_info) without throwing', () => {
      const minimalInsurance = {
        id: 2,
        insurance_type: 'dental',
        company_name: 'Basic Dental',
        member_name: 'John Smith',
        member_id: 'D1',
        effective_date: '2024-01-01',
        status: 'active',
      };

      expect(() => {
        render(
          <MantineWrapper>
            <InsuranceViewModal
              {...defaultProps}
              insurance={minimalInsurance}
              practitioners={[]}
            />
          </MantineWrapper>
        );
      }).not.toThrow();

      expect(
        screen.getAllByText('Basic Dental').length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
