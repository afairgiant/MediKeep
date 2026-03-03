import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import render from '../../test-utils/render';
import TrendChartSelector from './TrendChartSelector';

// Mock the API service
vi.mock('../../services/api/index.js', () => ({
  apiService: {
    getAvailableTrendData: vi.fn().mockResolvedValue({
      vital_types: [
        { vital_type: 'heart_rate', display_name: 'Heart Rate', unit: 'bpm', count: 15 },
        { vital_type: 'weight', display_name: 'Weight', unit: 'lbs', count: 8 },
        { vital_type: 'systolic_bp', display_name: 'Systolic Blood Pressure', unit: 'mmHg', count: 10 },
      ],
      lab_test_names: [
        { test_name: 'Glucose', unit: 'mg/dL', count: 12 },
        { test_name: 'TSH', unit: 'mIU/L', count: 5 },
      ],
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

// Mock useApi hook
vi.mock('../../hooks/useApi.js', () => ({
  useApi: () => ({
    loading: false,
    error: null,
    execute: vi.fn(async (fn) => {
      const result = await fn(new AbortController().signal);
      return result;
    }),
    clearError: vi.fn(),
    setError: vi.fn(),
  }),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Return the key with interpolated values for testing
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
  updateVitalChartTimeRange: vi.fn(),
  addLabTestChart: vi.fn(),
  removeLabTestChart: vi.fn(),
  updateLabTestChartTimeRange: vi.fn(),
  trendChartCount: 0,
};

describe('TrendChartSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vital sign checkboxes after loading', async () => {
    render(<TrendChartSelector {...defaultProps} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText(/Heart Rate/)).toBeInTheDocument();
      expect(screen.getByText(/Weight/)).toBeInTheDocument();
    });
  });

  it('calls addVitalChart when checkbox is checked', async () => {
    render(<TrendChartSelector {...defaultProps} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText(/Heart Rate/)).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', { name: /Heart Rate/ });
    fireEvent.click(checkbox);

    expect(defaultProps.addVitalChart).toHaveBeenCalledWith('heart_rate');
  });

  it('calls removeVitalChart when checkbox is unchecked', async () => {
    const props = {
      ...defaultProps,
      trendCharts: {
        vital_charts: [{ vital_type: 'heart_rate', time_range: '1year' }],
        lab_test_charts: [],
      },
      trendChartCount: 1,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText(/Heart Rate/)).toBeInTheDocument();
    });

    const checkbox = screen.getByRole('checkbox', { name: /Heart Rate/ });
    fireEvent.click(checkbox);

    expect(defaultProps.removeVitalChart).toHaveBeenCalledWith('heart_rate');
  });

  it('shows selected charts with time range and remove button', async () => {
    const props = {
      ...defaultProps,
      trendCharts: {
        vital_charts: [{ vital_type: 'heart_rate', time_range: '1year' }],
        lab_test_charts: [{ test_name: 'Glucose', time_range: '6months' }],
      },
      trendChartCount: 2,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText('Heart Rate')).toBeInTheDocument();
      expect(screen.getByText('Glucose')).toBeInTheDocument();
    });

    // Should have remove buttons
    const removeButtons = screen.getAllByRole('button', { name: /Remove/ });
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
        vital_charts: [{ vital_type: 'weight', time_range: '1year' }],
        lab_test_charts: [],
      },
      trendChartCount: 1,
    };

    render(<TrendChartSelector {...props} />, { skipRouter: true });

    await waitFor(() => {
      expect(screen.getByText('Weight')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /Remove Weight/ });
    fireEvent.click(removeButton);

    expect(defaultProps.removeVitalChart).toHaveBeenCalledWith('weight');
  });
});
