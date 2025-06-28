/**
 * VitalsChart Component - Enhanced Version
 * Modern chart visualization for patient vital signs trends using Recharts
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  ReferenceLine,
  ScatterChart,
  Scatter,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Activity,
  Heart,
  Thermometer,
  Weight,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  AreaChart as AreaIcon,
  ScatterChart as ScatterIcon,
  Settings,
  Download,
  Maximize2,
  Filter,
} from 'lucide-react';
import { vitalsService } from '../../services/medical/vitalsService';
import { formatDate } from '../../utils/helpers';
import './VitalsChart.css';

// Chart type constants
const CHART_TYPES = {
  LINE: 'line',
  AREA: 'area',
  BAR: 'bar',
  SCATTER: 'scatter',
};

// Vital sign configurations with enhanced metadata
const VITAL_CONFIGS = {
  systolic_bp: {
    label: 'Systolic BP',
    unit: 'mmHg',
    color: '#e53e3e',
    gradient: ['#e53e3e', '#fc8181'],
    icon: Heart,
    normalRange: { min: 90, max: 120 },
    dangerThreshold: { min: 60, max: 180 },
  },
  diastolic_bp: {
    label: 'Diastolic BP',
    unit: 'mmHg',
    color: '#dd6b20',
    gradient: ['#dd6b20', '#f6ad55'],
    icon: Heart,
    normalRange: { min: 60, max: 80 },
    dangerThreshold: { min: 40, max: 120 },
  },
  heart_rate: {
    label: 'Heart Rate',
    unit: 'BPM',
    color: '#4299e1',
    gradient: ['#4299e1', '#63b3ed'],
    icon: Activity,
    normalRange: { min: 60, max: 100 },
    dangerThreshold: { min: 40, max: 150 },
  },
  temperature: {
    label: 'Temperature',
    unit: '°F',
    color: '#38a169',
    gradient: ['#38a169', '#68d391'],
    icon: Thermometer,
    normalRange: { min: 97.0, max: 99.5 },
    dangerThreshold: { min: 95.0, max: 104.0 },
  },
  weight: {
    label: 'Weight',
    unit: 'lbs',
    color: '#805ad5',
    gradient: ['#805ad5', '#b794f6'],
    icon: Weight,
    normalRange: null, // Varies by person
    dangerThreshold: null,
  },
  oxygen_saturation: {
    label: 'O₂ Saturation',
    unit: '%',
    color: '#00b5d8',
    gradient: ['#00b5d8', '#0bc5ea'],
    icon: Zap,
    normalRange: { min: 95, max: 100 },
    dangerThreshold: { min: 85, max: 100 },
  },
  respiratory_rate: {
    label: 'Respiratory Rate',
    unit: '/min',
    color: '#d69e2e',
    gradient: ['#d69e2e', '#ecc94b'],
    icon: Activity,
    normalRange: { min: 12, max: 20 },
    dangerThreshold: { min: 8, max: 30 },
  },
};

const VitalsChart = ({
  patientId,
  dateRange: initialDateRange = 180,
  height = 400,
  showControls = true,
  defaultMetrics = ['weight', 'systolic_bp', 'diastolic_bp', 'heart_rate'],
  chartType: initialChartType = CHART_TYPES.LINE,
}) => {
  // State management
  const [vitals, setVitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [selectedMetrics, setSelectedMetrics] = useState(defaultMetrics);
  const [chartType, setChartType] = useState(initialChartType);
  const [showNormalRanges, setShowNormalRanges] = useState(true);
  const [zoomedRange, setZoomedRange] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [controlsExpanded, setControlsExpanded] = useState(false);

  // Data loading with improved error handling
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

      const data = response?.data || response;
      const processedData = Array.isArray(data)
        ? data
            .filter(v => v && v.recorded_date) // Filter out invalid entries
            .sort(
              (a, b) => new Date(a.recorded_date) - new Date(b.recorded_date)
            )
            .map(vital => ({
              ...vital,
              displayDate: formatDate(vital.recorded_date),
              timestamp: new Date(vital.recorded_date).getTime(),
            }))
        : [];

      setVitals(processedData);
    } catch (err) {
      console.error('Error loading vitals data:', err);
      setError(err.message || 'Failed to load vitals data');
      setVitals([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, dateRange]);

  useEffect(() => {
    loadVitalsData();
  }, [loadVitalsData]);

  // Auto-filter selected metrics to only include those with data
  useEffect(() => {
    if (vitals.length > 0) {
      setSelectedMetrics(prev => {
        const metricsWithData = prev.filter(metric =>
          vitals.some(v => v[metric] != null)
        );
        // Only update if there's a change to avoid unnecessary re-renders
        if (metricsWithData.length !== prev.length) {
          return metricsWithData;
        }
        return prev;
      });
    }
  }, [vitals]);

  // Memoized chart data processing
  const chartData = useMemo(() => {
    if (!vitals.length) return [];

    const processedData = vitals.map(vital => {
      const dataPoint = {
        date: vital.displayDate,
        timestamp: vital.timestamp,
        ...vital,
      };

      // Calculate additional derived metrics
      if (vital.weight && vital.height) {
        dataPoint.bmi = vitalsService.calculateBMI(vital.weight, vital.height);
      }

      if (vital.systolic_bp && vital.diastolic_bp) {
        dataPoint.pulse_pressure = vital.systolic_bp - vital.diastolic_bp;
        dataPoint.mean_arterial_pressure =
          vital.diastolic_bp + dataPoint.pulse_pressure / 3;
      }

      return dataPoint;
    });

    // Debug: log the data to see what we're working with
    console.log('Chart data:', processedData);
    console.log('First data point:', processedData[0]);

    return processedData;
  }, [vitals]);

  // Chart rendering functions
  const renderChart = () => {
    if (!chartData.length) {
      console.log('No chart data available');
      return null;
    }

    console.log('Rendering chart with data points:', chartData.length);

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 90 },
    };

    switch (chartType) {
      case CHART_TYPES.AREA:
        return (
          <AreaChart {...commonProps}>
            <defs>
              {selectedMetrics.map(metric => {
                const config = VITAL_CONFIGS[metric];
                return (
                  <linearGradient
                    key={metric}
                    id={`gradient-${metric}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={config.color}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={config.color}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={VITAL_CONFIGS[metric].color}
                fill={`url(#gradient-${metric})`}
                strokeWidth={2}
                dot={{
                  fill: VITAL_CONFIGS[metric].color,
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  stroke: VITAL_CONFIGS[metric].color,
                  strokeWidth: 2,
                }}
                animationDuration={animationEnabled ? 1000 : 0}
              />
            ))}
          </AreaChart>
        );

      case CHART_TYPES.BAR:
        return (
          <BarChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {selectedMetrics.map(metric => (
              <Bar
                key={metric}
                dataKey={metric}
                fill={VITAL_CONFIGS[metric].color}
                opacity={0.8}
                radius={[2, 2, 0, 0]}
                animationDuration={animationEnabled ? 800 : 0}
              />
            ))}
          </BarChart>
        );

      case CHART_TYPES.SCATTER:
        return (
          <ScatterChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {selectedMetrics.map(metric => (
              <Scatter
                key={metric}
                dataKey={metric}
                fill={VITAL_CONFIGS[metric].color}
                opacity={0.7}
              />
            ))}
          </ScatterChart>
        );

      default: // LINE
        return (
          <LineChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={VITAL_CONFIGS[metric].color}
                strokeWidth={2}
                dot={{
                  fill: VITAL_CONFIGS[metric].color,
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  stroke: VITAL_CONFIGS[metric].color,
                  strokeWidth: 2,
                }}
                animationDuration={animationEnabled ? 1000 : 0}
                connectNulls={false}
              />
            ))}
          </LineChart>
        );
    }
  };

  // Render axes with dynamic domains
  const renderAxes = () => {
    // Calculate appropriate interval based on data points and date range
    const getInterval = () => {
      const dataLength = chartData.length;

      // For different date ranges, show different numbers of ticks
      if (dateRange <= 7) {
        return 0; // Show all dates for week view
      } else if (dateRange <= 30) {
        return Math.max(1, Math.floor(dataLength / 8)); // Show ~8 ticks for month
      } else if (dateRange <= 90) {
        return Math.max(1, Math.floor(dataLength / 6)); // Show ~6 ticks for 3 months
      } else if (dateRange <= 365) {
        return Math.max(1, Math.floor(dataLength / 5)); // Show ~5 ticks for year
      } else {
        return Math.max(1, Math.floor(dataLength / 4)); // Show ~4 ticks for longer periods
      }
    };

    return (
      <>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine
          axisLine
          height={80}
        />
        <YAxis
          tick={{
            fontSize: 11,
            fill: '#4a5568',
            fontWeight: 500,
          }}
          tickLine={{
            stroke: '#4a5568',
            strokeWidth: 1,
          }}
          axisLine={{
            stroke: '#4a5568',
            strokeWidth: 1,
          }}
          domain={['dataMin - 5', 'dataMax + 5']}
          width={60}
        />
      </>
    );
  };

  // Render normal range reference lines
  const renderNormalRanges = () => {
    if (!showNormalRanges) return null;

    return selectedMetrics.map(metric => {
      const config = VITAL_CONFIGS[metric];
      if (!config.normalRange) return null;

      return (
        <React.Fragment key={`range-${metric}`}>
          <ReferenceLine
            y={config.normalRange.min}
            stroke={config.color}
            strokeDasharray="5 5"
            opacity={0.5}
            label={{
              value: `${config.label} Min: ${config.normalRange.min}`,
              position: 'topLeft',
            }}
          />
          <ReferenceLine
            y={config.normalRange.max}
            stroke={config.color}
            strokeDasharray="5 5"
            opacity={0.5}
            label={{
              value: `${config.label} Max: ${config.normalRange.max}`,
              position: 'topLeft',
            }}
          />
        </React.Fragment>
      );
    });
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <motion.div
        className="vitals-tooltip"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="tooltip-header">
          <Calendar size={14} />
          <span>{label}</span>
        </div>
        <div className="tooltip-content">
          {payload.map((entry, index) => {
            const config = VITAL_CONFIGS[entry.dataKey];
            if (!config || entry.value == null) return null;

            const Icon = config.icon;
            const isAbnormal =
              config.normalRange &&
              (entry.value < config.normalRange.min ||
                entry.value > config.normalRange.max);

            return (
              <div
                key={index}
                className={`tooltip-item ${isAbnormal ? 'abnormal' : ''}`}
              >
                <div className="tooltip-icon">
                  <Icon size={14} color={config.color} />
                </div>
                <span className="tooltip-label">{config.label}:</span>
                <span className="tooltip-value" style={{ color: config.color }}>
                  {typeof entry.value === 'number'
                    ? entry.value.toFixed(1)
                    : entry.value}{' '}
                  {config.unit}
                </span>
                {isAbnormal && <span className="abnormal-indicator">⚠️</span>}
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  // Custom legend component
  const CustomLegend = ({ payload }) => (
    <div className="chart-legend">
      {payload?.map((entry, index) => {
        const config = VITAL_CONFIGS[entry.dataKey];
        if (!config) return null;

        const Icon = config.icon;
        return (
          <div
            key={index}
            className="legend-item"
            style={{ color: entry.color }}
          >
            <Icon size={16} />
            <span>
              {config.label} ({config.unit})
            </span>
          </div>
        );
      })}
    </div>
  );

  // Metric selection handlers
  const toggleMetric = metric => {
    // Check if metric has data before allowing selection
    const hasData = vitals.some(v => v[metric] != null);

    setSelectedMetrics(prev => {
      const isSelected = prev.includes(metric);
      if (isSelected) {
        // Always allow deselection
        return prev.filter(m => m !== metric);
      } else {
        // Only allow selection if metric has data
        if (hasData) {
          return [...prev, metric];
        }
        return prev; // Don't add if no data
      }
    });
  };

  const selectAllMetrics = () => {
    const availableMetrics = Object.keys(VITAL_CONFIGS).filter(key =>
      vitals.some(v => v[key] != null)
    );
    setSelectedMetrics(availableMetrics);
  };

  const clearAllMetrics = () => {
    setSelectedMetrics([]);
  };

  // Chart type selection
  const ChartTypeSelector = () => (
    <div className="chart-type-selector">
      {[
        { type: CHART_TYPES.LINE, icon: LineChartIcon, label: 'Line' },
        { type: CHART_TYPES.AREA, icon: AreaIcon, label: 'Area' },
        { type: CHART_TYPES.BAR, icon: BarChart3, label: 'Bar' },
        { type: CHART_TYPES.SCATTER, icon: ScatterIcon, label: 'Scatter' },
      ].map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          className={`chart-type-btn ${chartType === type ? 'active' : ''}`}
          onClick={() => setChartType(type)}
          title={`${label} Chart`}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );

  // Date range options
  const dateRangeOptions = [
    { value: 7, label: 'Last 7 Days' },
    { value: 30, label: 'Last 30 Days' },
    { value: 90, label: 'Last 3 Months' },
    { value: 180, label: 'Last 6 Months' },
    { value: 365, label: 'Last Year' },
    { value: 730, label: 'Last 2 Years' },
  ];

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        className="vitals-chart loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="loading-content">
          <div className="loading-spinner">
            <Activity className="animate-pulse" size={24} />
          </div>
          <p>Loading vitals data...</p>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        className="vitals-chart error"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>Unable to load chart data</h3>
          <p>{error}</p>
          <button onClick={loadVitalsData} className="retry-btn">
            <TrendingUp size={16} />
            Try Again
          </button>
        </div>
      </motion.div>
    );
  }

  // Empty state
  if (!vitals.length) {
    return (
      <motion.div
        className="vitals-chart empty"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="empty-content">
          <div className="empty-icon">
            <BarChart3 size={48} />
          </div>
          <h3>No vitals data available</h3>
          <p>Chart will appear once vitals are recorded</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`vitals-chart ${isFullscreen ? 'fullscreen' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {showControls && (
        <div className="chart-controls">
          {/* Collapsible Controls Header */}
          <motion.div
            className="controls-header"
            onClick={() => setControlsExpanded(!controlsExpanded)}
            whileHover={{ backgroundColor: 'rgba(66, 153, 225, 0.05)' }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="controls-header-content">
              <div className="controls-title">
                <Filter size={18} />
                <span>Chart Filters & Options</span>
              </div>
              <div className="controls-summary">
                <span className="active-filters">
                  {selectedMetrics.length} metrics selected
                </span>
                <span className="time-range-summary">
                  {dateRangeOptions.find(opt => opt.value === dateRange)?.label}
                </span>
                <motion.div
                  className="expand-icon"
                  animate={{ rotate: controlsExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <TrendingDown size={16} />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Expandable Controls Content */}
          <AnimatePresence>
            {controlsExpanded && (
              <motion.div
                className="controls-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="controls-grid">
                  <div className="controls-section">
                    <h4>Chart Type</h4>
                    <ChartTypeSelector />
                  </div>

                  <div className="controls-section">
                    <h4>Time Range</h4>
                    <select
                      value={dateRange}
                      onChange={e => setDateRange(Number(e.target.value))}
                      className="time-range-select"
                    >
                      {dateRangeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="controls-section metrics-section">
                    <h4>
                      Metrics
                      <div className="metric-controls">
                        <button
                          onClick={selectAllMetrics}
                          className="control-btn"
                        >
                          All
                        </button>
                        <button
                          onClick={clearAllMetrics}
                          className="control-btn"
                        >
                          None
                        </button>
                      </div>
                    </h4>
                    <div className="metrics-grid">
                      {Object.entries(VITAL_CONFIGS).map(([key, config]) => {
                        const Icon = config.icon;
                        const isSelected = selectedMetrics.includes(key);
                        const hasData = vitals.some(v => v[key] != null);

                        return (
                          <motion.label
                            key={key}
                            className={`metric-checkbox ${isSelected ? 'selected' : ''} ${!hasData ? 'no-data' : ''}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleMetric(key)}
                              disabled={!hasData}
                            />
                            <div
                              className="metric-icon"
                              style={{ color: config.color }}
                            >
                              <Icon size={16} />
                            </div>
                            <span className="metric-label">
                              {config.label}
                              {!hasData && (
                                <span className="no-data-indicator">
                                  {' '}
                                  (No data)
                                </span>
                              )}
                            </span>
                          </motion.label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="controls-section">
                    <h4>Options</h4>
                    <div className="chart-options">
                      <label className="option-checkbox">
                        <input
                          type="checkbox"
                          checked={showNormalRanges}
                          onChange={e => setShowNormalRanges(e.target.checked)}
                        />
                        <span>Show Normal Ranges</span>
                      </label>
                      <label className="option-checkbox">
                        <input
                          type="checkbox"
                          checked={animationEnabled}
                          onChange={e => setAnimationEnabled(e.target.checked)}
                        />
                        <span>Enable Animations</span>
                      </label>
                    </div>
                  </div>

                  <div className="controls-section">
                    <h4>Actions</h4>
                    <div className="action-buttons">
                      <button
                        className="action-btn"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title="Toggle Fullscreen"
                      >
                        <Maximize2 size={16} />
                        <span>Fullscreen</span>
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => window.print()}
                        title="Print Chart"
                      >
                        <Download size={16} />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div
        className="chart-container"
        style={{ height: isFullscreen ? '80vh' : height }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={chartType}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="chart-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Data Points:</span>
            <span className="stat-value">{vitals.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Date Range:</span>
            <span className="stat-value">
              {vitals.length > 0 &&
                `${formatDate(vitals[0].recorded_date)} - ${formatDate(vitals[vitals.length - 1].recorded_date)}`}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Selected Metrics:</span>
            <span className="stat-value">{selectedMetrics.length}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VitalsChart;
