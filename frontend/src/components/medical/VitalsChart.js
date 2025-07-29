/**
 * VitalsChart Component - Enhanced Version
 * Modern chart visualization for patient vital signs trends using Recharts and Mantine
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
  Paper,
  Group,
  Button,
  Select,
  Checkbox,
  Stack,
  Text,
  Title,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Badge,
  Grid,
  Box,
  Collapse,
  Divider,
  Card,
  UnstyledButton,
  rem,
} from '@mantine/core';
import {
  IconCalendar,
  IconActivity,
  IconHeart,
  IconTemperature,
  IconWeight,
  IconBolt,
  IconTrendingUp,
  IconTrendingDown,
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconChartDots,
  IconSettings,
  IconDownload,
  IconMaximize,
  IconFilter,
  IconRefresh,
  IconAlertTriangle,
  IconChartHistogram,
} from '@tabler/icons-react';
import { vitalsService } from '../../services/medical/vitalsService';
import { formatDate } from '../../utils/helpers';

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
    color: 'var(--mantine-color-red-6)',
    gradient: ['var(--mantine-color-red-6)', 'var(--mantine-color-red-4)'],
    icon: IconHeart,
    normalRange: { min: 90, max: 120 },
    dangerThreshold: { min: 60, max: 180 },
  },
  diastolic_bp: {
    label: 'Diastolic BP',
    unit: 'mmHg',
    color: 'var(--mantine-color-orange-6)',
    gradient: ['var(--mantine-color-orange-6)', 'var(--mantine-color-orange-4)'],
    icon: IconHeart,
    normalRange: { min: 60, max: 80 },
    dangerThreshold: { min: 40, max: 120 },
  },
  heart_rate: {
    label: 'Heart Rate',
    unit: 'BPM',
    color: 'var(--mantine-color-blue-6)',
    gradient: ['var(--mantine-color-blue-6)', 'var(--mantine-color-blue-4)'],
    icon: IconActivity,
    normalRange: { min: 60, max: 100 },
    dangerThreshold: { min: 40, max: 150 },
  },
  temperature: {
    label: 'Temperature',
    unit: '°F',
    color: 'var(--mantine-color-green-6)',
    gradient: ['var(--mantine-color-green-6)', 'var(--mantine-color-green-4)'],
    icon: IconTemperature,
    normalRange: { min: 97.0, max: 99.5 },
    dangerThreshold: { min: 95.0, max: 104.0 },
  },
  weight: {
    label: 'Weight',
    unit: 'lbs',
    color: 'var(--mantine-color-violet-6)',
    gradient: ['var(--mantine-color-violet-6)', 'var(--mantine-color-violet-4)'],
    icon: IconWeight,
    normalRange: null, // Varies by person
    dangerThreshold: null,
  },
  oxygen_saturation: {
    label: 'O₂ Saturation',
    unit: '%',
    color: 'var(--mantine-color-cyan-6)',
    gradient: ['var(--mantine-color-cyan-6)', 'var(--mantine-color-cyan-4)'],
    icon: IconBolt,
    normalRange: { min: 95, max: 100 },
    dangerThreshold: { min: 85, max: 100 },
  },
  respiratory_rate: {
    label: 'Respiratory Rate',
    unit: '/min',
    color: 'var(--mantine-color-yellow-6)',
    gradient: ['var(--mantine-color-yellow-6)', 'var(--mantine-color-yellow-4)'],
    icon: IconActivity,
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
    if (!vitals.length || !selectedMetrics.length) return [];

    return vitals.map(vital => {
      const dataPoint = {
        date: vital.displayDate,
        timestamp: vital.timestamp,
        fullDate: vital.recorded_date,
      };

      selectedMetrics.forEach(metric => {
        if (vital[metric] != null) {
          dataPoint[metric] = Number(vital[metric]);
        }
      });

      return dataPoint;
    });
  }, [vitals, selectedMetrics]);

  // Chart rendering logic
  const renderChart = () => {
    if (!chartData.length) return null;

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    switch (chartType) {
      case CHART_TYPES.AREA:
        return (
          <AreaChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => {
              const config = VITAL_CONFIGS[metric];
              return (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={config.color}
                  fill={config.color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={animationEnabled}
                />
              );
            })}
          </AreaChart>
        );

      case CHART_TYPES.BAR:
        return (
          <BarChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => {
              const config = VITAL_CONFIGS[metric];
              return (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={config.color}
                  opacity={0.8}
                  isAnimationActive={animationEnabled}
                />
              );
            })}
          </BarChart>
        );

      case CHART_TYPES.SCATTER:
        return (
          <ScatterChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => {
              const config = VITAL_CONFIGS[metric];
              return (
                <Scatter
                  key={metric}
                  dataKey={metric}
                  fill={config.color}
                  isAnimationActive={animationEnabled}
                />
              );
            })}
          </ScatterChart>
        );

      default: // LINE
        return (
          <LineChart {...commonProps}>
            {renderAxes()}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {renderNormalRanges()}
            {selectedMetrics.map(metric => {
              const config = VITAL_CONFIGS[metric];
              return (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={animationEnabled}
                />
              );
            })}
          </LineChart>
        );
    }
  };

  // Render chart axes
  const renderAxes = () => {
    const getInterval = () => {
      if (chartData.length <= 7) return 0;
      if (chartData.length <= 30) return Math.ceil(chartData.length / 7);
      return Math.ceil(chartData.length / 10);
    };

    return (
      <>
        <XAxis
          dataKey="date"
          interval={getInterval()}
          tick={{ fontSize: 12 }}
          tickMargin={10}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickMargin={10}
          domain={['dataMin - 5', 'dataMax + 5']}
        />
      </>
    );
  };

  // Render normal ranges as reference lines
  const renderNormalRanges = () => {
    if (!showNormalRanges) return null;

    return selectedMetrics.map(metric => {
      const config = VITAL_CONFIGS[metric];
      if (!config.normalRange) return null;

      return (
        <g key={`${metric}-range`}>
          <ReferenceLine
            y={config.normalRange.min}
            stroke={config.color}
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={config.normalRange.max}
            stroke={config.color}
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
        </g>
      );
    });
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper withBorder p="sm" shadow="md">
          <Text fw={500} size="sm" mb="xs">
            {label}
          </Text>
          <Stack gap="xs">
            {payload.map((entry, index) => {
              const config = VITAL_CONFIGS[entry.dataKey];
              if (!config) return null;

              return (
                <Group key={index} gap="xs">
                  <Box
                    w={12}
                    h={12}
                    style={{
                      backgroundColor: entry.color,
                      borderRadius: '50%',
                    }}
                  />
                  <Text size="sm">
                    {config.label}: {entry.value} {config.unit}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Paper>
      );
    }
    return null;
  };

  // Custom legend component
  const CustomLegend = ({ payload }) => (
    <Group justify="center" gap="md" mt="md">
      {payload?.map((entry, index) => {
        const config = VITAL_CONFIGS[entry.dataKey];
        if (!config) return null;

        const Icon = config.icon;
        return (
          <Group key={index} gap="xs">
            <Icon size={16} color={entry.color} />
            <Text size="sm" c={entry.color}>
              {config.label}
            </Text>
          </Group>
        );
      })}
    </Group>
  );

  // Metric selection helpers
  const toggleMetric = metric => {
    const hasData = vitals.some(v => v[metric] != null);
    if (!hasData) return;

    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
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
  const chartTypeOptions = [
    { value: CHART_TYPES.LINE, label: 'Line', icon: IconChartLine },
    { value: CHART_TYPES.AREA, label: 'Area', icon: IconChartArea },
    { value: CHART_TYPES.BAR, label: 'Bar', icon: IconChartBar },
    { value: CHART_TYPES.SCATTER, label: 'Scatter', icon: IconChartDots },
  ];

  // Date range options
  const dateRangeOptions = [
    { value: '7', label: 'Last 7 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 3 Months' },
    { value: '180', label: 'Last 6 Months' },
    { value: '365', label: 'Last Year' },
    { value: '730', label: 'Last 2 Years' },
  ];

  // Loading state
  if (isLoading) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text>Loading vitals data...</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Alert
          color="red"
          title="Unable to load chart data"
          icon={<IconAlertTriangle size={16} />}
        >
          <Stack gap="md">
            <Text>{error}</Text>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={loadVitalsData}
              variant="light"
            >
              Try Again
            </Button>
          </Stack>
        </Alert>
      </Paper>
    );
  }

  // Empty state
  if (!vitals.length) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Center>
          <Stack align="center" gap="md">
            <IconChartHistogram size={48} color="gray" />
            <Title order={3} c="dimmed">
              No vitals data available
            </Title>
            <Text c="dimmed" ta="center">
              Chart will appear once vitals are recorded
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        {showControls && (
          <Card withBorder>
            <Stack gap="md">
              {/* Controls Header */}
              <UnstyledButton
                onClick={() => setControlsExpanded(!controlsExpanded)}
                w="100%"
              >
                <Group justify="space-between" align="center">
                  <Group gap="sm">
                    <IconFilter size={18} />
                    <Text fw={500}>Chart Filters & Options</Text>
                  </Group>
                  <Group gap="md">
                    <Badge variant="light" size="sm">
                      {selectedMetrics.length} metrics selected
                    </Badge>
                    <Badge variant="light" size="sm">
                      {
                        dateRangeOptions.find(
                          opt => opt.value === dateRange.toString()
                        )?.label
                      }
                    </Badge>
                    <ActionIcon variant="subtle" size="sm">
                      <IconTrendingDown
                        size={16}
                        style={{
                          transform: controlsExpanded
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </ActionIcon>
                  </Group>
                </Group>
              </UnstyledButton>

              {/* Collapsible Controls */}
              <Collapse in={controlsExpanded}>
                <Stack gap="md">
                  <Divider />
                  <Grid>
                    {/* Chart Type */}
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Text fw={500} size="sm" mb="xs">
                        Chart Type
                      </Text>
                      <Group gap="xs">
                        {chartTypeOptions.map(
                          ({ value, label, icon: Icon }) => (
                            <Button
                              key={value}
                              variant={chartType === value ? 'filled' : 'light'}
                              size="xs"
                              leftSection={<Icon size={14} />}
                              onClick={() => setChartType(value)}
                            >
                              {label}
                            </Button>
                          )
                        )}
                      </Group>
                    </Grid.Col>

                    {/* Time Range */}
                    <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                      <Text fw={500} size="sm" mb="xs">
                        Time Range
                      </Text>
                      <Select
                        value={dateRange.toString()}
                        onChange={value => setDateRange(Number(value))}
                        data={dateRangeOptions}
                        size="xs"
                      />
                    </Grid.Col>

                    {/* Metrics */}
                    <Grid.Col span={{ base: 12, lg: 4 }}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={500} size="sm">
                          Metrics
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={selectAllMetrics}
                          >
                            All
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={clearAllMetrics}
                          >
                            None
                          </Button>
                        </Group>
                      </Group>
                      <Grid>
                        {Object.entries(VITAL_CONFIGS).map(([key, config]) => {
                          const Icon = config.icon;
                          const isSelected = selectedMetrics.includes(key);
                          const hasData = vitals.some(v => v[key] != null);

                          return (
                            <Grid.Col key={key} span={6}>
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleMetric(key)}
                                disabled={!hasData}
                                label={
                                  <Group gap="xs">
                                    <Icon size={14} color={config.color} />
                                    <Text size="sm">
                                      {config.label}
                                      {!hasData && (
                                        <Text size="xs" c="dimmed">
                                          {' '}
                                          (No data)
                                        </Text>
                                      )}
                                    </Text>
                                  </Group>
                                }
                              />
                            </Grid.Col>
                          );
                        })}
                      </Grid>
                    </Grid.Col>

                    {/* Options */}
                    <Grid.Col span={{ base: 12, lg: 2 }}>
                      <Text fw={500} size="sm" mb="xs">
                        Options
                      </Text>
                      <Stack gap="xs">
                        <Checkbox
                          checked={showNormalRanges}
                          onChange={event =>
                            setShowNormalRanges(event.currentTarget.checked)
                          }
                          label="Show Normal Ranges"
                          size="sm"
                        />
                        <Checkbox
                          checked={animationEnabled}
                          onChange={event =>
                            setAnimationEnabled(event.currentTarget.checked)
                          }
                          label="Enable Animations"
                          size="sm"
                        />
                      </Stack>
                    </Grid.Col>
                  </Grid>

                  {/* Action Buttons */}
                  <Group justify="flex-end" gap="xs">
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconMaximize size={14} />}
                      onClick={() => setIsFullscreen(!isFullscreen)}
                    >
                      Fullscreen
                    </Button>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconDownload size={14} />}
                      onClick={() => window.print()}
                    >
                      Export
                    </Button>
                  </Group>
                </Stack>
              </Collapse>
            </Stack>
          </Card>
        )}

        {/* Chart Container */}
        <Box
          style={{
            height: isFullscreen ? '80vh' : height,
            width: '100%',
          }}
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
        </Box>

        {/* Chart Summary */}
        <Card withBorder>
          <Group justify="space-between" align="center">
            <Group gap="xl">
              <Box>
                <Text size="xs" c="dimmed">
                  Data Points
                </Text>
                <Text fw={500}>{vitals.length}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Date Range
                </Text>
                <Text fw={500} size="sm">
                  {vitals.length > 0 &&
                    `${formatDate(vitals[0].recorded_date)} - ${formatDate(vitals[vitals.length - 1].recorded_date)}`}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Selected Metrics
                </Text>
                <Text fw={500}>{selectedMetrics.length}</Text>
              </Box>
            </Group>
          </Group>
        </Card>
      </Stack>
    </Paper>
  );
};

export default VitalsChart;
