/**
 * VitalsChart Component
 * Chart visualization for patient vital signs trends
 *
 * TODO: Fix date adapter configuration and time range display issues:
 * - Chart.js date adapter preprocessor errors
 * - Time range not adjusting properly based on actual data span
 * - Need to properly configure chartjs-adapter-date-fns
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { vitalsService } from '../../services/medical/vitalsService';
import { formatDate } from '../../utils/helpers';
import './VitalsChart.css';

// Import date adapter after Chart.js registration
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const VitalsChart = ({ patientId, dateRange: initialDateRange = 180 }) => {
  const [vitals, setVitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [selectedMetrics, setSelectedMetrics] = useState([
    'weight', // Weight is the main metric with data
    'systolic_bp',
    'diastolic_bp',
    'heart_rate',
  ]);
  const loadVitalsData = useCallback(async () => {
    if (!patientId) return;

    try {
      setIsLoading(true);
      setError(null);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const response = await vitalsService.getPatientVitalsDateRange(
        patientId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Extract data from response (same issue as other API calls)
      const data = response?.data || response;

      setVitals(
        Array.isArray(data)
          ? data.sort(
              (a, b) => new Date(a.recorded_date) - new Date(b.recorded_date)
            )
          : []
      );
    } catch (err) {
      setError(err.message || 'Failed to load vitals data');
      setVitals([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, dateRange]);

  useEffect(() => {
    loadVitalsData();
  }, [loadVitalsData]);
  const chartData = useMemo(() => {
    if (!vitals.length) return null;

    const labels = vitals.map(v => {
      const date = new Date(v.recorded_date);
      // Ensure we have valid dates
      if (isNaN(date.getTime())) {
        return new Date(); // fallback to current date
      }
      return date;
    });

    const datasets = [];

    const metricConfigs = {
      systolic_bp: {
        label: 'Systolic BP (mmHg)',
        borderColor: '#e53e3e',
        backgroundColor: 'rgba(229, 62, 62, 0.1)',
        yAxisID: 'bp',
      },
      diastolic_bp: {
        label: 'Diastolic BP (mmHg)',
        borderColor: '#dd6b20',
        backgroundColor: 'rgba(221, 107, 32, 0.1)',
        yAxisID: 'bp',
      },
      heart_rate: {
        label: 'Heart Rate (BPM)',
        borderColor: '#4299e1',
        backgroundColor: 'rgba(66, 153, 225, 0.1)',
        yAxisID: 'hr',
      },
      temperature: {
        label: 'Temperature (°F)',
        borderColor: '#38a169',
        backgroundColor: 'rgba(56, 161, 105, 0.1)',
        yAxisID: 'temp',
      },
      weight: {
        label: 'Weight (lbs)',
        borderColor: '#805ad5',
        backgroundColor: 'rgba(128, 90, 213, 0.1)',
        yAxisID: 'weight',
      },
      oxygen_saturation: {
        label: 'O2 Saturation (%)',
        borderColor: '#00b5d8',
        backgroundColor: 'rgba(0, 181, 216, 0.1)',
        yAxisID: 'o2',
      },
      respiratory_rate: {
        label: 'Respiratory Rate (breaths/min)',
        borderColor: '#d69e2e',
        backgroundColor: 'rgba(214, 158, 46, 0.1)',
        yAxisID: 'rr',
      },
    };

    selectedMetrics.forEach(metric => {
      if (metricConfigs[metric]) {
        const data = vitals
          .map(v => {
            const date = new Date(v.recorded_date);
            const value = v[metric];

            // Skip invalid dates or null/undefined values
            if (
              isNaN(date.getTime()) ||
              value === null ||
              value === undefined
            ) {
              return null;
            }

            return {
              x: date,
              y: parseFloat(value), // Ensure numeric values
            };
          })
          .filter(point => point !== null);

        if (data.length > 0) {
          datasets.push({
            ...metricConfigs[metric],
            data,
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          });
        }
      }
    });

    return {
      labels,
      datasets,
    };
  }, [vitals, selectedMetrics]);

  // Calculate effective date range based on actual data span
  const effectiveDateRange = useMemo(() => {
    if (!vitals.length) return dateRange;

    const dates = vitals
      .map(v => new Date(v.recorded_date))
      .sort((a, b) => a - b);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const actualDays = Math.ceil(
      (lastDate - firstDate) / (1000 * 60 * 60 * 24)
    );

    // Use the smaller of actual data span or selected range for better display
    return Math.min(Math.max(actualDays + 1, 7), dateRange); // Minimum 7 days for proper display
  }, [vitals, dateRange]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: 'Vital Signs Trends',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              return formatDate(new Date(context[0].parsed.x).toISOString());
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit:
              getEffectiveDateRange <= 7
                ? 'day'
                : getEffectiveDateRange <= 30
                  ? 'day'
                  : getEffectiveDateRange <= 90
                    ? 'week'
                    : getEffectiveDateRange <= 365
                      ? 'month'
                      : 'quarter',
            stepSize:
              getEffectiveDateRange <= 7
                ? 1
                : getEffectiveDateRange <= 30
                  ? Math.max(1, Math.ceil(getEffectiveDateRange / 6))
                  : getEffectiveDateRange <= 90
                    ? 1
                    : undefined,
            displayFormats: {
              day: 'MMM dd',
              week: 'MMM dd',
              month: 'MMM yyyy',
              quarter: 'MMM yyyy',
            },
            tooltipFormat: 'MMM dd, yyyy',
          },
          adapters: {
            date: {
              locale: 'en-US',
            },
          },
          title: {
            display: true,
            text: 'Date',
          },
          ticks: {
            source: 'auto',
            autoSkip: true,
            maxTicksLimit:
              getEffectiveDateRange <= 7
                ? 7
                : getEffectiveDateRange <= 30
                  ? 6
                  : getEffectiveDateRange <= 90
                    ? 8
                    : getEffectiveDateRange <= 365
                      ? 10
                      : 6,
          },
        },
        bp: {
          type: 'linear',
          display:
            selectedMetrics.includes('systolic_bp') ||
            selectedMetrics.includes('diastolic_bp'),
          position: 'left',
          title: {
            display: true,
            text: 'Blood Pressure (mmHg)',
          },
          min: 60,
          max: 200,
          grid: {
            color: 'rgba(229, 62, 62, 0.1)',
          },
        },
        hr: {
          type: 'linear',
          display: selectedMetrics.includes('heart_rate'),
          position: 'right',
          title: {
            display: true,
            text: 'Heart Rate (BPM)',
          },
          min: 50,
          max: 120,
          grid: {
            drawOnChartArea: false,
            color: 'rgba(66, 153, 225, 0.1)',
          },
        },
        temp: {
          type: 'linear',
          display: selectedMetrics.includes('temperature'),
          position: 'right',
          title: {
            display: true,
            text: 'Temperature (°F)',
          },
          min: 96,
          max: 102,
          grid: {
            drawOnChartArea: false,
            color: 'rgba(56, 161, 105, 0.1)',
          },
        },
        weight: {
          type: 'linear',
          display: selectedMetrics.includes('weight'),
          position: 'right',
          title: {
            display: true,
            text: 'Weight (lbs)',
          },
          grid: {
            drawOnChartArea: false,
            color: 'rgba(128, 90, 213, 0.1)',
          },
        },
        o2: {
          type: 'linear',
          display: selectedMetrics.includes('oxygen_saturation'),
          position: 'right',
          title: {
            display: true,
            text: 'O2 Sat (%)',
          },
          min: 90,
          max: 100,
          grid: {
            drawOnChartArea: false,
            color: 'rgba(0, 181, 216, 0.1)',
          },
        },
        rr: {
          type: 'linear',
          display: selectedMetrics.includes('respiratory_rate'),
          position: 'right',
          title: {
            display: true,
            text: 'Resp Rate (breaths/min)',
          },
          min: 10,
          max: 30,
          grid: {
            drawOnChartArea: false,
            color: 'rgba(214, 158, 46, 0.1)',
          },
        },
      },
    }),
    [effectiveDateRange, selectedMetrics]
  );

  const availableMetrics = [
    { key: 'systolic_bp', label: 'Systolic BP', color: '#e53e3e' },
    { key: 'diastolic_bp', label: 'Diastolic BP', color: '#dd6b20' },
    { key: 'heart_rate', label: 'Heart Rate', color: '#4299e1' },
    { key: 'temperature', label: 'Temperature', color: '#38a169' },
    { key: 'weight', label: 'Weight', color: '#805ad5' },
    { key: 'oxygen_saturation', label: 'O2 Saturation', color: '#00b5d8' },
    { key: 'respiratory_rate', label: 'Respiratory Rate', color: '#d69e2e' },
  ];
  const toggleMetric = metric => {
    setSelectedMetrics(prev =>
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  const getTimeRangeLabel = days => {
    if (days <= 30) return `${days} days`;
    if (days <= 90) return `${Math.round(days / 30)} months`;
    if (days <= 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} year${days > 365 ? 's' : ''}`;
  };

  // Calculate effective date range based on actual data span
  const getEffectiveDateRange = useMemo(() => {
    if (!vitals.length) return dateRange;

    const dates = vitals
      .map(v => new Date(v.recorded_date))
      .sort((a, b) => a - b);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const actualDays = Math.ceil(
      (lastDate - firstDate) / (1000 * 60 * 60 * 24)
    );

    // Use the smaller of actual data span or selected range for better display
    return Math.min(actualDays + 1, dateRange);
  }, [vitals, dateRange]);

  if (isLoading) {
    return (
      <div className="vitals-chart loading">
        <div className="loading-spinner">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vitals-chart error">
        <div className="error-message">
          <p>Error loading chart data: {error}</p>
          <button onClick={loadVitalsData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!vitals.length) {
    return (
      <div className="vitals-chart empty">
        <div className="empty-message">
          <p>No vitals data available for charting</p>
          <p className="empty-subtitle">
            Chart will appear once vitals are recorded
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="vitals-chart">
      <div className="chart-controls">
        <div className="time-range-selector">
          <label className="control-label">Time Range:</label>
          <select
            value={dateRange}
            onChange={e => setDateRange(Number(e.target.value))}
            className="time-range-select"
          >
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 3 Months</option>
            <option value={180}>Last 6 Months</option>
            <option value={365}>Last Year</option>
            <option value={730}>Last 2 Years</option>
          </select>
        </div>

        <div className="metrics-selector">
          <label className="control-label">Display Metrics:</label>
          <div className="metrics-grid">
            {availableMetrics.map(metric => (
              <label key={metric.key} className="metric-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric.key)}
                  onChange={() => toggleMetric(metric.key)}
                />
                <span
                  className="metric-color"
                  style={{ backgroundColor: metric.color }}
                ></span>
                {metric.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-container">
        {chartData && <Line data={chartData} options={chartOptions} />}
      </div>{' '}
      <div className="chart-info">
        <p>
          Showing {vitals.length} measurements over the last{' '}
          {getTimeRangeLabel(dateRange)}
        </p>
      </div>
    </div>
  );
};

export default VitalsChart;
