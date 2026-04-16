import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import render from '../../test-utils/render';
import TrendChartSelector from './TrendChartSelector';

// Mock the API service
vi.mock('../../services/api/index.js', () => ({
  apiService: {
    getAvailableTrendData: vi.fn().mockResolvedValue({
      vital_types: [
        {
          vital_type: 'heart_rate',
          display_name: 'Heart Rate',
          unit: 'bpm',
          count: 15,
        },
        { vital_type: 'weight', display_name: 'Weight', unit: 'lbs', count: 8 },
        {
          vital_type: 'systolic_bp',
          display_name: 'Systolic Blood Pressure',
          unit: 'mmHg',
          count: 10,
        },
      ],
      lab_test_names: [
        { test_name: 'Glucose', unit: 'mg/dL', count: 12 },
        { test_name: 'TSH', unit: 'mIU/L', count: 5 },
      ],
    }),
    getTrendChartCounts: vi.fn().mockResolvedValue({
      vital_counts: { heart_rate: 15, weight: 8 },
      lab_test_counts: { Glucose: 12 },
    }),
  },
}));

// Mock the logger
vi.mock('../../services/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) {
        let result = key;
        Object.entries(opts).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
        return result;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const defaultProps = {
  trendCharts: { vital_charts: [], lab_test_charts: [] },
  addVitalChart: vi.fn(),
  removeVitalChart: vi.fn(),
  updateVitalChartDates: vi.fn(),
  addLabTestChart: vi.fn(),
  removeLabTestChart: vi.fn(),
  updateLabTestChartDates: vi.fn(),
  trendChartCount: 0,
};

describe('TrendChartSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vital sign checkboxes after loading', async () => {
    render(<TrendChartSelector {...defaultProps} />, { skipRouter: true });

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Heart Rate/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: /Weight/ })
      ).toBeInTheDocument();
    });
  });

  it('calls addVitalChart when checkbox is checked', async () => {
    render(<TrendChartSelector {...defaultProps} />, { skipRouter: true });

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Heart Rate/ })
      ).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', { name: /Heart Rate/ });
    fireEvent.click(checkbox);

    expect(defaultProps.addVitalChart).toHaveBeenCalledWith('heart_rate');
  });

  it('calls removeVitalChart when checkbox is unchecked', async () => {
    const props = {
      ...defaultProps,
      trendCharts: {
        vital_charts: [
          {
            vital_type: 'heart_rate',
            date_from: '2025-03-03',
            date_to: '2026-03-03',
          },
        ],
        lab_test_charts: [],
      },
      trendChartCount: 1,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Heart Rate/ })
      ).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', { name: /Heart Rate/ });
    fireEvent.click(checkbox);

    expect(defaultProps.removeVitalChart).toHaveBeenCalledWith('heart_rate');
  });

  it('shows selected charts with badges and remove buttons', async () => {
    const props = {
      ...defaultProps,
      trendCharts: {
        vital_charts: [
          {
            vital_type: 'heart_rate',
            date_from: '2025-03-03',
            date_to: '2026-03-03',
          },
        ],
        lab_test_charts: [
          {
            test_name: 'Glucose',
            date_from: '2025-09-03',
            date_to: '2026-03-03',
          },
        ],
      },
      trendChartCount: 2,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Heart Rate/ })
      ).toBeInTheDocument();
    });

    // Should have remove buttons (aria-label uses i18n key)
    const removeButtons = screen.getAllByRole('button', {
      name: /removeChart/,
    });
    expect(removeButtons.length).toBe(2);
  });

  it('shows max reached alert when 10 charts selected', async () => {
    const props = {
      ...defaultProps,
      trendChartCount: 10,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText(/maxReached/)).toBeInTheDocument();
    });
  });

  it('calls removeVitalChart when remove button clicked', async () => {
    const props = {
      ...defaultProps,
      trendCharts: {
        vital_charts: [
          {
            vital_type: 'weight',
            date_from: '2025-03-03',
            date_to: '2026-03-03',
          },
        ],
        lab_test_charts: [],
      },
      trendChartCount: 1,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /Weight/ })
      ).toBeInTheDocument();
    });

    // aria-label is the i18n key with the name interpolated
    const removeButton = screen.getByRole('button', { name: /removeChart/ });
    fireEvent.click(removeButton);

    expect(defaultProps.removeVitalChart).toHaveBeenCalledWith('weight');
  });
});
