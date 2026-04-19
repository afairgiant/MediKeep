/**
 * TestComponentTrendChart component
 * Displays historical trend data as a line chart with reference ranges
 * Uses Recharts for visualization
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Dot,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts';
import { Paper, Stack, Text, Badge, Group } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import useDateFormat from '../../../hooks/useDateFormat';
import { TrendResponse } from '../../../services/api/labTestComponentApi';
import { generateYAxisConfig } from '../../../utils/chartAxisUtils';
import {
  getQualitativeDisplayName,
  getQualitativeColor,
} from '../../../constants/labCategories';

const toTimestamp = (dateValue?: string | null): number | null => {
  if (!dateValue) return null;
  const ts = new Date(dateValue).getTime();
  return Number.isNaN(ts) ? null : ts;
};

const formatAxisDate = (
  value: number,
  formatDate: (dateValue: string | Date, options?: any) => string
) => formatDate(new Date(value), { includeTime: false });

const buildTimeDomain = (values: number[]) => {
  if (!values.length) return ['auto', 'auto'] as const;
  if (values.length === 1) {
    const dayMs = 24 * 60 * 60 * 1000;
    return [values[0] - dayMs, values[0] + dayMs] as const;
  }
  return ['dataMin', 'dataMax'] as const;
};

interface TestComponentTrendChartProps {
  trendData: TrendResponse;
}

const QualitativeChart: React.FC<{ trendData: TrendResponse }> = ({
  trendData,
}) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { formatDate } = useDateFormat();
  const chartData = useMemo(() => {
    return trendData.data_points
      .map(point => {
        const rawDate = point.recorded_date || point.created_at;
        const timestamp = toTimestamp(rawDate);
        if (timestamp === null) return null;
        const qv = point.qualitative_value || 'unknown';
        const numericValue = qv === 'positive' || qv === 'detected' ? 1 : 0;

        return {
          date: rawDate,
          timestamp,
          value: numericValue,
          qualitativeValue: qv,
          status: point.status,
          testName: point.lab_result.test_name,
          id: point.id,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .reverse();
  }, [trendData.data_points]);

  const timeValues = useMemo(
    () => chartData.map(point => point.timestamp),
    [chartData]
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <Paper
        withBorder
        p="sm"
        shadow="md"
        radius="md"
        bg="var(--mantine-color-body)"
      >
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {formatDate(data.date)}
          </Text>
          <Badge
            size="lg"
            variant="filled"
            color={getQualitativeColor(data.qualitativeValue)}
          >
            {getQualitativeDisplayName(data.qualitativeValue)}
          </Badge>
          <Text size="xs" c="dimmed">
            {t('labresults:trendChart.labLabel', { name: data.testName })}
          </Text>
        </Stack>
      </Paper>
    );
  };

  if (chartData.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="var(--color-bg-secondary)">
        <Text size="sm" c="dimmed" ta="center">
          {t('labresults:trendChart.noDataPoints')}
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-light)"
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={buildTimeDomain(timeValues)}
              tickFormatter={(value: number) =>
                formatAxisDate(value, formatDate)
              }
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
              stroke="#adb5bd"
              allowDuplicatedCategory
            />
            <YAxis
              dataKey="value"
              type="number"
              domain={[-0.5, 1.5]}
              ticks={[0, 1]}
              tickFormatter={(val: number) =>
                val === 1 ? 'Positive / Detected' : 'Negative / Undetected'
              }
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter name={trendData.test_name} data={chartData} fill="#228be6">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.value === 1 ? '#fa5252' : '#40c057'}
                  r={6}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Paper>
      <Group gap="sm" justify="center">
        <Badge size="sm" variant="light" color="red">
          {t('labresults:trendChart.positiveDetected')}
        </Badge>
        <Badge size="sm" variant="light" color="green">
          {t('labresults:trendChart.negativeUndetected')}
        </Badge>
      </Group>
    </Stack>
  );
};

const TestComponentTrendChart: React.FC<TestComponentTrendChartProps> = ({
  trendData,
}) => {
  const { t } = useTranslation(['medical', 'shared']);
  const { formatDate } = useDateFormat();
  const chartData = useMemo(() => {
    return trendData.data_points
      .map(point => {
        const rawDate = point.recorded_date || point.created_at;
        const timestamp = toTimestamp(rawDate);
        if (timestamp === null) return null;

        return {
          date: rawDate,
          timestamp,
          value: point.value,
          refMin: point.ref_range_min,
          refMax: point.ref_range_max,
          status: point.status,
          testName: point.lab_result.test_name,
          id: point.id,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .reverse();
  }, [trendData.data_points]);

  const timeValues = useMemo(
    () => chartData.map(point => point.timestamp),
    [chartData]
  );

  // Get the most recent reference range for display
  const referenceRange = useMemo(() => {
    const latest = trendData.data_points[0]; // Already sorted most recent first
    if (!latest) return null;

    return {
      min: latest.ref_range_min,
      max: latest.ref_range_max,
      text: latest.ref_range_text,
    };
  }, [trendData.data_points]);

  // Calculate Y-axis configuration with nice, rounded tick values
  const yAxisConfig = useMemo(() => {
    const values = chartData
      .map(d => d.value)
      .filter((v): v is number => v != null);
    const refMins = chartData
      .map(d => d.refMin)
      .filter((v): v is number => v != null);
    const refMaxs = chartData
      .map(d => d.refMax)
      .filter((v): v is number => v != null);

    return generateYAxisConfig([...values, ...refMins, ...refMaxs]);
  }, [chartData]);

  // Custom dot to show status colors
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;

    let fill = '#228be6'; // Default blue

    if (payload.status) {
      switch (payload.status.toLowerCase()) {
        case 'normal':
          fill = '#40c057'; // Green
          break;
        case 'high':
        case 'low':
          fill = '#fd7e14'; // Orange
          break;
        case 'critical':
          fill = '#fa5252'; // Red
          break;
        case 'abnormal':
          fill = '#fab005'; // Yellow
          break;
      }
    }

    return (
      <Dot cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={2} />
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <Paper
        withBorder
        p="sm"
        shadow="md"
        radius="md"
        bg="var(--mantine-color-body)"
      >
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {formatDate(data.date)}
          </Text>
          <Group gap="xs" align="baseline">
            <Text size="lg" fw={700} c="blue">
              {data.value}
            </Text>
            <Text size="sm" c="dimmed">
              {trendData.unit}
            </Text>
          </Group>

          {data.status && (
            <Badge size="sm" variant="light">
              {data.status}
            </Badge>
          )}

          {(data.refMin !== null || data.refMax !== null) && (
            <Text size="xs" c="dimmed">
              {t('labresults:trendChart.referenceValue', {
                min: data.refMin ?? '?',
                max: data.refMax ?? '?',
              })}{' '}
              {trendData.unit}
            </Text>
          )}

          <Text size="xs" c="dimmed">
            {t('labresults:trendChart.labLabel', { name: data.testName })}
          </Text>
        </Stack>
      </Paper>
    );
  };

  if (trendData.result_type === 'qualitative') {
    return <QualitativeChart trendData={trendData} />;
  }

  if (chartData.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="var(--color-bg-secondary)">
        <Text size="sm" c="dimmed" ta="center">
          {t('labresults:trendChart.noDataPoints')}
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Reference Range Legend */}
      {referenceRange &&
        (referenceRange.min !== null ||
          referenceRange.max !== null ||
          referenceRange.text) && (
          <Paper withBorder p="xs" radius="md" bg="var(--color-bg-secondary)">
            <Group gap="xs">
              <Text size="xs" fw={600}>
                {t('labresults:trendChart.referenceRange')}
              </Text>
              <Text size="xs">
                {referenceRange.text
                  ? `${referenceRange.text} ${trendData.unit}`
                  : `${referenceRange.min ?? '?'} - ${referenceRange.max ?? '?'} ${trendData.unit}`}
              </Text>
            </Group>
          </Paper>
        )}

      {/* Chart */}
      <Paper withBorder p="md" radius="md">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-light)"
            />

            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={buildTimeDomain(timeValues)}
              tickFormatter={(value: number) =>
                formatAxisDate(value, formatDate)
              }
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#adb5bd' }}
              stroke="#adb5bd"
              angle={-45}
              textAnchor="end"
              height={80}
            />

            <YAxis
              domain={yAxisConfig.domain}
              ticks={yAxisConfig.ticks}
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#adb5bd' }}
              stroke="#adb5bd"
              label={{
                value: trendData.unit,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12 },
              }}
              allowDataOverflow={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              iconType="line"
            />

            {/* Reference range area */}
            {referenceRange &&
              referenceRange.min !== null &&
              referenceRange.max !== null && (
                <ReferenceArea
                  y1={referenceRange.min}
                  y2={referenceRange.max}
                  fill="#40c057"
                  fillOpacity={0.1}
                  label=""
                />
              )}

            {/* Reference range lines */}
            {referenceRange && referenceRange.min !== null && (
              <ReferenceLine
                y={referenceRange.min}
                stroke="#40c057"
                strokeDasharray="3 3"
                label={{
                  value: 'Min',
                  position: 'right',
                  fontSize: 10,
                  fill: '#40c057',
                }}
              />
            )}

            {referenceRange && referenceRange.max !== null && (
              <ReferenceLine
                y={referenceRange.max}
                stroke="#40c057"
                strokeDasharray="3 3"
                label={{
                  value: 'Max',
                  position: 'right',
                  fontSize: 10,
                  fill: '#40c057',
                }}
              />
            )}

            {/* Value line */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#228be6"
              strokeWidth={2}
              dot={<CustomDot />}
              name={trendData.test_name}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Status Legend */}
      <Group gap="sm" justify="center">
        <Badge size="sm" variant="light" color="green">
          {t('labresults:stats.normal')}
        </Badge>
        <Badge size="sm" variant="light" color="orange">
          {t('labresults:trendChart.highLow')}
        </Badge>
        <Badge size="sm" variant="light" color="red">
          {t('labresults:stats.critical')}
        </Badge>
        <Badge size="sm" variant="light" color="yellow">
          {t('labresults:stats.abnormal')}
        </Badge>
      </Group>
    </Stack>
  );
};

export default TestComponentTrendChart;
