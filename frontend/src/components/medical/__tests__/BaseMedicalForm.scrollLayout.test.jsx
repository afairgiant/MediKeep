import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 *
 * Verifies that BaseMedicalForm passes the correct scroll-layout props to
 * ResponsiveModal: withScrollArea={false}, content overflow:hidden, body
 * overflowY:auto and flex:1, header flexShrink:0.
 *
 * Regression guard for the fix that prevents form buttons from overflowing
 * the dialog's painted background at high browser zoom levels.
 */
import render from '../../../test-utils/render';
import '@testing-library/jest-dom';
import MantineProcedureForm from '../MantineProcedureForm';

// Capture the props passed to ResponsiveModal so we can assert on them.
const capturedModalProps = { current: null };

vi.mock('../../adapters/ResponsiveModal', () => ({
  default: props => {
    capturedModalProps.current = props;
    if (!props.opened) return null;
    return (
      <div data-testid="responsive-modal">
        {props.children}
      </div>
    );
  },
  ResponsiveModal: props => {
    capturedModalProps.current = props;
    if (!props.opened) return null;
    return (
      <div data-testid="responsive-modal">
        {props.children}
      </div>
    );
  },
}));

vi.mock('../../adapters', () => ({
  ResponsiveModal: props => {
    capturedModalProps.current = props;
    if (!props.opened) return null;
    return (
      <div data-testid="responsive-modal">
        {props.children}
      </div>
    );
  },
  DateInput: ({ label, onChange, ...props }) => (
    <input aria-label={label} onChange={e => onChange && onChange(e.target.value)} {...props} />
  ),
}));

vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: Component => Component,
}));

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'md',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1200,
    height: 800,
  }),
}));

Element.prototype.scrollIntoView = vi.fn();

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add Procedure',
  formData: {
    procedure_name: '',
    procedure_type: '',
    procedure_code: '',
    procedure_setting: '',
    description: '',
    procedure_date: '',
    status: '',
    procedure_duration: '',
    facility: '',
    practitioner_id: '',
    procedure_complications: '',
    notes: '',
    anesthesia_type: '',
    anesthesia_notes: '',
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  practitioners: [],
};

describe('BaseMedicalForm scroll layout fix', () => {
  beforeEach(() => {
    capturedModalProps.current = null;
    vi.clearAllMocks();
  });

  test('passes withScrollArea={false} to ResponsiveModal', () => {
    render(<MantineProcedureForm {...defaultProps} />);
    expect(capturedModalProps.current).not.toBeNull();
    expect(capturedModalProps.current.withScrollArea).toBe(false);
  });

  test('passes content overflow:hidden so content never visually overflows the dialog', () => {
    render(<MantineProcedureForm {...defaultProps} />);
    const styles = capturedModalProps.current?.styles;
    // styles may be an object or a function (Mantine accepts both)
    const resolved =
      typeof styles === 'function' ? styles({}, {}, {}) : styles;
    expect(resolved?.content?.overflow).toBe('hidden');
  });

  test('passes body overflowY:auto so fields and buttons scroll together', () => {
    render(<MantineProcedureForm {...defaultProps} />);
    const styles = capturedModalProps.current?.styles;
    const resolved =
      typeof styles === 'function' ? styles({}, {}, {}) : styles;
    expect(resolved?.body?.overflowY).toBe('auto');
    expect(resolved?.body?.flex).toBe(1);
    expect(resolved?.body?.minHeight).toBe(0);
  });

  test('passes header flexShrink:0 to keep the header pinned', () => {
    render(<MantineProcedureForm {...defaultProps} />);
    const styles = capturedModalProps.current?.styles;
    const resolved =
      typeof styles === 'function' ? styles({}, {}, {}) : styles;
    expect(resolved?.header?.flexShrink).toBe(0);
  });
});
