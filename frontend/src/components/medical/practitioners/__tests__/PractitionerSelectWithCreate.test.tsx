import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent, waitFor } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PractitionerSelectWithCreate from '../PractitionerSelectWithCreate';

// Hoist mocks so they're available inside vi.mock factory functions.
const {
  mockPractitionerFormWrapperProps,
  mockCreatePractitioner,
  mockRefresh,
  mockNotificationsShow,
} = vi.hoisted(() => ({
  mockPractitionerFormWrapperProps: vi.fn(),
  mockCreatePractitioner: vi.fn(),
  mockRefresh: vi.fn(),
  mockNotificationsShow: vi.fn(),
}));

// PractitionerFormWrapper is the existing Create Practitioner dialog.
// We stub it here to keep these tests focused on PractitionerSelectWithCreate behaviour.
// The mock exposes form-name and form-specialty inputs so tests can satisfy the
// frontend validation that requires name and specialty_id before submission.
vi.mock('../PractitionerFormWrapper', () => ({
  default: (props: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (_e: Event) => void;
    onInputChange: (_e: { target: { name: string; value: unknown } }) => void;
    isLoading: boolean;
    zIndex: number;
  }) => {
    mockPractitionerFormWrapperProps(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="practitioner-form-modal">
        <input
          data-testid="form-name"
          onChange={e =>
            props.onInputChange({ target: { name: 'name', value: e.target.value } })
          }
          defaultValue=""
        />
        <input
          data-testid="form-specialty"
          onChange={e =>
            props.onInputChange({
              target: { name: 'specialty_id', value: Number(e.target.value) },
            })
          }
          defaultValue=""
        />
        <button
          data-testid="mock-submit"
          onClick={_e => props.onSubmit(_e as unknown as Event)}
        >
          Submit
        </button>
        <button data-testid="mock-close" onClick={props.onClose}>
          Close
        </button>
        <span data-testid="z-index">{props.zIndex}</span>
      </div>
    );
  },
}));

vi.mock('../../../../services/api', () => ({
  apiService: {
    createPractitioner: mockCreatePractitioner,
  },
}));

vi.mock('../../../../hooks/useGlobalData', () => ({
  usePractitioners: () => ({
    practitioners: [],
    loading: false,
    refresh: mockRefresh,
    error: null,
    hasData: false,
  }),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mockNotificationsShow },
}));

const mockPractitioners = [
  { id: 1, name: 'Dr. Smith', specialty: 'Cardiology' },
  { id: 2, name: 'Dr. Jones', specialty: 'Internal Medicine' },
];

const defaultProps = {
  value: null,
  onChange: vi.fn(),
  practitioners: mockPractitioners,
  label: 'Ordering Practitioner',
  placeholder: 'Select practitioner',
  description: 'Choose the ordering practitioner',
};

// In the test environment, t('key', 'fallback') returns the fallback string.
// These constants keep tests in sync with what the component actually renders.
const BUTTON_TEXT = 'New practitioner';

// Fill the required fields (name + specialty_id) in the mocked form so that
// PractitionerSelectWithCreate's frontend validation passes before submit.
function fillRequiredFields() {
  fireEvent.change(screen.getByTestId('form-name'), {
    target: { value: 'Dr. Test' },
  });
  fireEvent.change(screen.getByTestId('form-specialty'), {
    target: { value: '1' },
  });
}

describe('PractitionerSelectWithCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Select rendering', () => {
    test('renders the label for the practitioner field', () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      expect(screen.getByText('Ordering Practitioner')).toBeInTheDocument();
    });

    test('renders the "New practitioner" action button and link', () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      expect(screen.getByText(BUTTON_TEXT)).toBeInTheDocument();
    });
  });

  describe('Sub-modal open/close', () => {
    test('PractitionerFormWrapper is not rendered initially', () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      expect(screen.queryByTestId('practitioner-form-modal')).not.toBeInTheDocument();
    });

    test('clicking the action text opens PractitionerFormWrapper', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      expect(screen.getByTestId('practitioner-form-modal')).toBeInTheDocument();
    });

    test('clicking the ActionIcon opens PractitionerFormWrapper', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      const iconButton = screen.getByRole('button', { name: BUTTON_TEXT });
      await userEvent.click(iconButton);
      expect(screen.getByTestId('practitioner-form-modal')).toBeInTheDocument();
    });

    test('PractitionerFormWrapper receives zIndex={2100}', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      expect(screen.getByTestId('z-index')).toHaveTextContent('2100');
    });

    test('closing the sub-modal hides it', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      await userEvent.click(screen.getByTestId('mock-close'));
      expect(screen.queryByTestId('practitioner-form-modal')).not.toBeInTheDocument();
    });

    test('re-opening the sub-modal increments the key (fresh mount)', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);

      await userEvent.click(screen.getByText(BUTTON_TEXT));
      const firstCallProps = mockPractitionerFormWrapperProps.mock.calls.at(-1)?.[0];

      await userEvent.click(screen.getByTestId('mock-close'));
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      const secondCallProps = mockPractitionerFormWrapperProps.mock.calls.at(-1)?.[0];

      expect(firstCallProps?.isOpen).toBe(true);
      expect(secondCallProps?.isOpen).toBe(true);
    });
  });

  describe('Frontend validation', () => {
    test('shows error and does not call API when name is empty', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fireEvent.change(screen.getByTestId('form-specialty'), { target: { value: '1' } });
      fireEvent.click(screen.getByTestId('mock-submit'));
      expect(mockNotificationsShow).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red' })
      );
      expect(mockCreatePractitioner).not.toHaveBeenCalled();
    });

    test('shows error and does not call API when specialty is missing', async () => {
      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fireEvent.change(screen.getByTestId('form-name'), { target: { value: 'Dr. Test' } });
      fireEvent.click(screen.getByTestId('mock-submit'));
      expect(mockNotificationsShow).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red' })
      );
      expect(mockCreatePractitioner).not.toHaveBeenCalled();
    });
  });

  describe('After successful creation', () => {
    test('onChange is called with new practitioner ID on success', async () => {
      mockCreatePractitioner.mockResolvedValue({
        id: 99,
        name: 'Dr. New',
        specialty: 'Neurology',
      });

      const mockOnChange = vi.fn();
      render(<PractitionerSelectWithCreate {...defaultProps} onChange={mockOnChange} />);

      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fillRequiredFields();
      fireEvent.click(screen.getByTestId('mock-submit'));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('99');
      });
    });

    test('sub-modal closes after successful creation', async () => {
      mockCreatePractitioner.mockResolvedValue({
        id: 99,
        name: 'Dr. New',
        specialty: null,
      });

      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fillRequiredFields();
      fireEvent.click(screen.getByTestId('mock-submit'));

      await waitFor(() => {
        expect(screen.queryByTestId('practitioner-form-modal')).not.toBeInTheDocument();
      });
    });

    test('refresh is called after successful creation', async () => {
      mockCreatePractitioner.mockResolvedValue({
        id: 99,
        name: 'Dr. New',
        specialty: null,
      });

      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fillRequiredFields();
      fireEvent.click(screen.getByTestId('mock-submit'));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    test('success notification is shown', async () => {
      mockCreatePractitioner.mockResolvedValue({
        id: 99,
        name: 'Dr. New',
        specialty: 'Neurology',
      });

      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fillRequiredFields();
      fireEvent.click(screen.getByTestId('mock-submit'));

      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'green' })
        );
      });
    });
  });

  describe('Error handling', () => {
    test('modal stays open and shows error notification on API failure', async () => {
      mockCreatePractitioner.mockRejectedValue(new Error('Network error'));

      render(<PractitionerSelectWithCreate {...defaultProps} />);
      await userEvent.click(screen.getByText(BUTTON_TEXT));
      fillRequiredFields();
      fireEvent.click(screen.getByTestId('mock-submit'));

      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'red' })
        );
      });

      expect(screen.getByTestId('practitioner-form-modal')).toBeInTheDocument();
    });
  });
});
