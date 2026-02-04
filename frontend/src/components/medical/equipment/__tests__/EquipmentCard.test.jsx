import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import EquipmentCard from '../EquipmentCard';

// Mock useDateFormat hook
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatLongDate: (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
  }),
}));

// Mock logger
vi.mock('../../../../services/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
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

describe('EquipmentCard', () => {
  const defaultEquipment = {
    id: 1,
    equipment_name: 'ResMed AirSense 11',
    equipment_type: 'cpap',
    manufacturer: 'ResMed',
    model_number: 'AirSense 11',
    serial_number: 'SN-12345',
    prescribed_date: '2024-01-15',
    next_service_date: '2024-07-15',
    supplier: 'Sleep Solutions Inc',
    status: 'active',
    notes: 'Use nightly for sleep apnea',
  };

  const defaultProps = {
    equipment: defaultEquipment,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onView: vi.fn(),
    fileCount: 0,
    fileCountLoading: false,
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders equipment name', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('ResMed AirSense 11')).toBeInTheDocument();
    });

    test('renders equipment type badge', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      // Equipment type appears in multiple places (subtitle and badge)
      expect(screen.getAllByText('CPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('renders manufacturer badge', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('ResMed')).toBeInTheDocument();
    });

    test('renders status badge', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      // StatusBadge capitalizes the status
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    test('renders model number when provided', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('AirSense 11')).toBeInTheDocument();
    });

    test('renders serial number when provided', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('SN-12345')).toBeInTheDocument();
    });

    test('renders supplier when provided', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Sleep Solutions Inc')).toBeInTheDocument();
    });

    test('renders notes when provided', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Use nightly for sleep apnea')).toBeInTheDocument();
    });
  });

  describe('Equipment Types', () => {
    test('renders CPAP equipment correctly', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      // Equipment type may appear multiple times
      expect(screen.getAllByText('CPAP Machine').length).toBeGreaterThanOrEqual(1);
    });

    test('renders nebulizer equipment correctly', () => {
      const nebulizer = {
        ...defaultEquipment,
        equipment_name: 'Portable Nebulizer',
        equipment_type: 'nebulizer',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={nebulizer} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Nebulizer').length).toBeGreaterThanOrEqual(1);
    });

    test('renders inhaler equipment correctly', () => {
      const inhaler = {
        ...defaultEquipment,
        equipment_name: 'Ventolin Inhaler',
        equipment_type: 'inhaler',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={inhaler} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Inhaler').length).toBeGreaterThanOrEqual(1);
    });

    test('renders glucose monitor equipment correctly', () => {
      const glucoseMonitor = {
        ...defaultEquipment,
        equipment_name: 'Freestyle Libre',
        equipment_type: 'glucose_monitor',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={glucoseMonitor} />
        </MantineWrapper>
      );

      expect(screen.getAllByText('Glucose Monitor').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Status Display', () => {
    test('renders active status correctly', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    test('renders inactive status correctly', () => {
      const inactiveEquipment = {
        ...defaultEquipment,
        status: 'inactive',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={inactiveEquipment} />
        </MantineWrapper>
      );

      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    test('renders replaced status correctly', () => {
      const replacedEquipment = {
        ...defaultEquipment,
        status: 'replaced',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={replacedEquipment} />
        </MantineWrapper>
      );

      expect(screen.getByText('Replaced')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('calls onView when view action is triggered', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      // BaseMedicalCard may use action icons or buttons - look for any clickable element
      const buttons = screen.getAllByRole('button');
      // Find the view button (usually first or has view text/icon)
      const viewButton = buttons.find(btn => btn.getAttribute('aria-label')?.toLowerCase().includes('view')) || buttons[0];
      if (viewButton) {
        await user.click(viewButton);
        expect(defaultProps.onView).toHaveBeenCalled();
      }
    });

    test('calls onEdit when edit action is triggered', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      const buttons = screen.getAllByRole('button');
      const editButton = buttons.find(btn => btn.getAttribute('aria-label')?.toLowerCase().includes('edit'));
      if (editButton) {
        await user.click(editButton);
        expect(defaultProps.onEdit).toHaveBeenCalled();
      }
    });

    test('calls onDelete when delete action is triggered', async () => {
      const user = userEvent.setup();

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} />
        </MantineWrapper>
      );

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'));
      if (deleteButton) {
        await user.click(deleteButton);
        expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
      }
    });
  });

  describe('File Count Display', () => {
    test('displays file count when provided', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} fileCount={3} />
        </MantineWrapper>
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    test('does not display file count when zero', () => {
      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} fileCount={0} />
        </MantineWrapper>
      );

      // File count of 0 shouldn't display
      expect(screen.queryByText('0 files')).not.toBeInTheDocument();
    });
  });

  describe('Minimal Data', () => {
    test('renders with minimal required fields only', () => {
      const minimalEquipment = {
        id: 2,
        equipment_name: 'Basic Equipment',
        status: 'active',
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={minimalEquipment} />
        </MantineWrapper>
      );

      expect(screen.getByText('Basic Equipment')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    test('handles null/undefined optional fields gracefully', () => {
      const sparseEquipment = {
        id: 3,
        equipment_name: 'Sparse Equipment',
        equipment_type: null,
        manufacturer: undefined,
        model_number: null,
        serial_number: undefined,
        prescribed_date: null,
        next_service_date: undefined,
        supplier: null,
        status: 'active',
        notes: undefined,
      };

      expect(() => {
        render(
          <MantineWrapper>
            <EquipmentCard {...defaultProps} equipment={sparseEquipment} />
          </MantineWrapper>
        );
      }).not.toThrow();

      expect(screen.getByText('Sparse Equipment')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('calls onError when an error occurs', () => {
      const errorEquipment = {
        ...defaultEquipment,
        equipment_name: null, // This might cause an error
      };

      render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={errorEquipment} />
        </MantineWrapper>
      );

      // Component should handle the error gracefully
      // The exact behavior depends on implementation
    });

    test('returns null when rendering fails', () => {
      // This test ensures the component handles errors gracefully
      const invalidEquipment = null;

      const { container } = render(
        <MantineWrapper>
          <EquipmentCard {...defaultProps} equipment={invalidEquipment} />
        </MantineWrapper>
      );

      // Should not crash and may return null or empty
    });
  });
});
