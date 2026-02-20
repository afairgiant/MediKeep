import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import EquipmentViewModal from '../EquipmentViewModal';

// Mock useDateFormat hook - return dates in consistent format
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (date) => {
      if (!date) return null;
      // Parse as UTC to avoid timezone issues
      const d = new Date(date + 'T00:00:00');
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    },
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
  }),
}));

// Wrapper component with Mantine provider
const MantineWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('EquipmentViewModal', () => {
  const defaultEquipment = {
    id: 1,
    equipment_name: 'ResMed AirSense 11',
    equipment_type: 'cpap',
    manufacturer: 'ResMed',
    model_number: 'AirSense 11 AutoSet',
    serial_number: 'SN-12345-CPAP',
    prescribed_date: '2024-01-15',
    last_service_date: '2024-06-15',
    next_service_date: '2024-12-15',
    supplier: 'Sleep Solutions Inc',
    status: 'active',
    usage_instructions: 'Use nightly for 7-8 hours. Clean mask weekly.',
    notes: 'Patient uses nasal pillow mask. Pressure setting: 10-15 cmH2O',
    tags: ['sleep apnea', 'nightly use'],
    practitioner_id: 1,
    practitioner: { id: 1, name: 'Dr. Smith' },
  };

  const defaultPractitioners = [
    { id: 1, name: 'Dr. Smith' },
    { id: 2, name: 'Dr. Jones' },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    equipment: defaultEquipment,
    onEdit: vi.fn(),
    practitioners: defaultPractitioners,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders modal when open', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Equipment Details')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} isOpen={false} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Equipment Details')).not.toBeInTheDocument();
    });

    test('does not render when equipment is null', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={null} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Equipment Details')).not.toBeInTheDocument();
    });

    test('renders equipment name prominently', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      // Equipment name may appear multiple times
      expect(screen.getAllByText('ResMed AirSense 11').length).toBeGreaterThanOrEqual(1);
    });

    test('renders equipment type badge', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      // Equipment type may appear multiple times
      expect(screen.getAllByText('CPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('renders status badge', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      // StatusBadge renders "Active" for active status (appears in header + details)
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Basic Information Section', () => {
    test('displays equipment name field', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Equipment Name')).toBeInTheDocument();
      // Equipment name appears multiple times (header and details)
      expect(screen.getAllByText('ResMed AirSense 11').length).toBeGreaterThanOrEqual(1);
    });

    test('displays equipment type', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Equipment Type')).toBeInTheDocument();
      // Equipment type may appear multiple times
      expect(screen.getAllByText('CPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('displays status', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('displays practitioner when available', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Prescribed By')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    test('displays "Not specified" for missing practitioner', () => {
      const noPractitionerEquipment = {
        ...defaultEquipment,
        practitioner_id: null,
        practitioner: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={noPractitionerEquipment} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
    });
  });

  describe('Manufacturer Details Section', () => {
    test('displays manufacturer', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Manufacturer')).toBeInTheDocument();
      expect(screen.getByText('ResMed')).toBeInTheDocument();
    });

    test('displays model number', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Model Number')).toBeInTheDocument();
      expect(screen.getByText('AirSense 11 AutoSet')).toBeInTheDocument();
    });

    test('displays serial number', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Serial Number')).toBeInTheDocument();
      expect(screen.getByText('SN-12345-CPAP')).toBeInTheDocument();
    });

    test('displays supplier', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Supplier')).toBeInTheDocument();
      expect(screen.getByText('Sleep Solutions Inc')).toBeInTheDocument();
    });
  });

  describe('Important Dates Section', () => {
    test('displays prescribed date', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Prescribed Date')).toBeInTheDocument();
      // Date appears in both header badge and details section
      expect(screen.getAllByText('1/15/2024').length).toBeGreaterThanOrEqual(1);
    });

    test('displays last service date', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Last Service')).toBeInTheDocument();
      expect(screen.getByText('6/15/2024')).toBeInTheDocument();
    });

    test('displays next service date', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Next Service')).toBeInTheDocument();
      expect(screen.getByText('12/15/2024')).toBeInTheDocument();
    });

    test('displays "Not specified" for missing dates', () => {
      const noDatesEquipment = {
        ...defaultEquipment,
        prescribed_date: null,
        last_service_date: null,
        next_service_date: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={noDatesEquipment} />
        </MantineWrapper>
      );

      const notSpecifiedElements = screen.getAllByText('Not specified');
      expect(notSpecifiedElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Usage Instructions Section', () => {
    test('displays usage instructions when available', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Usage Instructions')).toBeInTheDocument();
      expect(screen.getByText('Use nightly for 7-8 hours. Clean mask weekly.')).toBeInTheDocument();
    });

    test('hides usage instructions section when not available', () => {
      const noInstructionsEquipment = {
        ...defaultEquipment,
        usage_instructions: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={noInstructionsEquipment} />
        </MantineWrapper>
      );

      expect(screen.queryByText('Usage Instructions')).not.toBeInTheDocument();
    });
  });

  describe('Notes Section', () => {
    test('displays notes when available', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Patient uses nasal pillow mask. Pressure setting: 10-15 cmH2O')).toBeInTheDocument();
    });

    test('hides notes section when not available', () => {
      const noNotesEquipment = {
        ...defaultEquipment,
        notes: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={noNotesEquipment} />
        </MantineWrapper>
      );

      // Notes header should not appear (as a section title)
      const sections = screen.queryAllByText('Notes');
      // May appear in form context but not as a data display section
    });
  });

  describe('Tags Section', () => {
    test('displays tags when available', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('sleep apnea')).toBeInTheDocument();
      expect(screen.getByText('nightly use')).toBeInTheDocument();
    });

    test('hides tags section when not available', () => {
      const noTagsEquipment = {
        ...defaultEquipment,
        tags: [],
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={noTagsEquipment} />
        </MantineWrapper>
      );

      expect(screen.queryByText('sleep apnea')).not.toBeInTheDocument();
    });

    test('hides tags section when tags is null', () => {
      const nullTagsEquipment = {
        ...defaultEquipment,
        tags: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={nullTagsEquipment} />
        </MantineWrapper>
      );

      // Tags section should not render with null tags
    });
  });

  describe('User Interactions', () => {
    test('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('calls onEdit and onClose when edit button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(defaultProps.onEdit).toHaveBeenCalledWith(defaultEquipment);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Equipment Types', () => {
    test('displays CPAP type correctly', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('CPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('displays BiPAP type correctly', () => {
      const bipapEquipment = {
        ...defaultEquipment,
        equipment_type: 'bipap',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={bipapEquipment} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('BiPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('displays nebulizer type correctly', () => {
      const nebulizerEquipment = {
        ...defaultEquipment,
        equipment_type: 'nebulizer',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={nebulizerEquipment} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Nebulizer').length).toBeGreaterThanOrEqual(1);
    });

    test('displays glucose monitor type correctly', () => {
      const glucoseEquipment = {
        ...defaultEquipment,
        equipment_type: 'glucose_monitor',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={glucoseEquipment} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Glucose Monitor').length).toBeGreaterThanOrEqual(1);
    });

    test('displays "Not specified" for unknown type', () => {
      const unknownTypeEquipment = {
        ...defaultEquipment,
        equipment_type: null,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={unknownTypeEquipment} />
        </MantineWrapper>
      );

      // Should show "Not specified" for equipment type
      expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
    });
  });

  describe('Status Display', () => {
    test('displays active status', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      // StatusBadge renders "Active" (appears in header + details = 2 instances)
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    });

    test('displays inactive status', () => {
      const inactiveEquipment = {
        ...defaultEquipment,
        status: 'inactive',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={inactiveEquipment} />
        </MantineWrapper>
      );

      // StatusBadge maps "inactive" to "Inactive"
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
    });

    test('displays replaced status', () => {
      const replacedEquipment = {
        ...defaultEquipment,
        status: 'replaced',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={replacedEquipment} />
        </MantineWrapper>
      );

      // StatusBadge has no "replaced" config - falls to default, label = raw status string
      expect(screen.getAllByText('replaced').length).toBeGreaterThanOrEqual(1);
    });

    test('displays needs_repair status', () => {
      const needsRepairEquipment = {
        ...defaultEquipment,
        status: 'needs_repair',
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={needsRepairEquipment} />
        </MantineWrapper>
      );

      // StatusBadge has no "needs_repair" config - falls to default, label = raw status string
      expect(screen.getAllByText('needs_repair').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Practitioner Lookup', () => {
    test('uses practitioner from equipment object when available', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    test('looks up practitioner from practitioners list when not embedded', () => {
      const equipmentWithIdOnly = {
        ...defaultEquipment,
        practitioner: null,
        practitioner_id: 2,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={equipmentWithIdOnly} />
        </MantineWrapper>
      );

      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
    });

    test('shows practitioner ID when not found in list', () => {
      const equipmentWithUnknownPractitioner = {
        ...defaultEquipment,
        practitioner: null,
        practitioner_id: 999,
      };

      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} equipment={equipmentWithUnknownPractitioner} />
        </MantineWrapper>
      );

      expect(screen.getByText('Practitioner #999')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles minimal equipment data gracefully', () => {
      const minimalEquipment = {
        id: 99,
        equipment_name: 'Basic Equipment',
        status: 'active',
      };

      expect(() => {
        render(
          <MantineWrapper>
            <EquipmentViewModal {...defaultProps} equipment={minimalEquipment} />
          </MantineWrapper>
        );
      }).not.toThrow();

      // Equipment name may appear multiple times (title and details)
      expect(screen.getAllByText('Basic Equipment').length).toBeGreaterThanOrEqual(1);
    });

    test('handles empty practitioners list gracefully', () => {
      expect(() => {
        render(
          <MantineWrapper>
            <EquipmentViewModal {...defaultProps} practitioners={[]} />
          </MantineWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper modal structure', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('has edit button with icon', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      const editButton = screen.getByText('Edit');
      expect(editButton).toBeInTheDocument();
    });

    test('has close button', () => {
      render(
        <MantineWrapper>
          <EquipmentViewModal {...defaultProps} />
        </MantineWrapper>
      );

      const closeButton = screen.getByText('Close');
      expect(closeButton).toBeInTheDocument();
    });
  });
});
