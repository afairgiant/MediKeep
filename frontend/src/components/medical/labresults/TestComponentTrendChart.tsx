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
  Cell
} from 'recharts';
import { Paper, Stack, Text, Badge, Group } from '@mantine/core';
import { TrendResponse } from '../../../services/api/labTestComponentApi';
import { generateYAxisConfig } from '../../../utils/chartAxisUtils';
import { getQualitativeDisplayName, getQualitativeColor } from '../../../constants/labCategories';

interface TestComponentTrendChartProps {
  trendData: TrendResponse;
}

const QualitativeChart: React.FC<{ trendData: TrendResponse }> = ({ trendData }) => {
  const chartData = useMemo(() => {
    return trendData.data_points.map((point) => {
      const dateStr = point.recorded_date || point.created_at.split('T')[0];
      const qv = point.qualitative_value || 'unknown';
      // Map to binary: positive/detected = 1, negative/undetected = 0
      const numericValue = (qv === 'positive' || qv === 'detected') ? 1 : 0;

      return {
        date: dateStr,
        value: numericValue,
        qualitativeValue: qv,
        status: point.status,
        testName: point.lab_result.test_name,
        id: point.id
      };
    }).reverse();
  }, [trendData.data_points]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <Paper withBorder p="sm" shadow="md" radius="md" bg="white">
        <Stack gap="xs">
          <Text size="sm" fw={600}>{data.date}</Text>
          <Badge
            size="lg"
            variant="filled"
            color={getQualitativeColor(data.qualitativeValue)}
          >
            {getQualitativeDisplayName(data.qualitativeValue)}
          </Badge>
          <Text size="xs" c="dimmed">Lab: {data.testName}</Text>
        </Stack>
      </Paper>
    );
  };

  if (chartData.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="gray.0">
        <Text size="sm" c="dimmed" ta="center">No data points to display</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis
              dataKey="date"
              type="category"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
              stroke="#adb5bd"
              allowDuplicatedCategory={false}
            />
            <YAxis
              type="number"
              domain={[-0.5, 1.5]}
              ticks={[0, 1]}
              tickFormatter={(val: number) => val === 1 ? 'Positive / Detected' : 'Negative / Undetected'}
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
        <Badge size="sm" variant="light" color="red">Positive/Detected</Badge>
        <Badge size="sm" variant="light" color="green">Negative/Undetected</Badge>
      </Group>
    </Stack>
  );
};

const TestComponentTrendChart: React.FC<TestComponentTrendChartProps> = ({ trendData }) => {
  const chartData = useMemo(() => {
    return trendData.data_points.map((point) => {
      // Use recorded_date if available, otherwise use created_at date
      const dateStr = point.recorded_date || point.created_at.split('T')[0];

      return {
        date: dateStr,
        value: point.value,
        refMin: point.ref_range_min,
        refMax: point.ref_range_max,
        status: point.status,
        testName: point.lab_result.test_name,
        id: point.id
      };
    }).reverse(); // Reverse to show oldest first (left to right)
  }, [trendData.data_points]);

  // Get the most recent reference range for display
  const referenceRange = useMemo(() => {
    const latest = trendData.data_points[0]; // Already sorted most recent first
    if (!latest) return null;

    return {
      min: latest.ref_range_min,
      max: latest.ref_range_max,
      text: latest.ref_range_text
    };
  }, [trendData.data_points]);

  // Calculate Y-axis configuration with nice, rounded tick values
  const yAxisConfig = useMemo(() => {
    const values = chartData.map(d => d.value).filter((v): v is number => v != null);
    const refMins = chartData.map(d => d.refMin).filter((v): v is number => v != null);
    const refMaxs = chartData.map(d => d.refMax).filter((v): v is number => v != null);

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

    return <Dot cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={2} />;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <Paper withBorder p="sm" shadow="md" radius="md" bg="white">
        <Stack gap="xs">
          <Text size="sm" fw={600}>{data.date}</Text>
          <Group gap="xs" align="baseline">
            <Text size="lg" fw={700} c="blue">{data.value}</Text>
            <Text size="sm" c="dimmed">{trendData.unit}</Text>
          </Group>

          {data.status && (
            <Badge size="sm" variant="light">
              {data.status}
            </Badge>
          )}

          {(data.refMin !== null || data.refMax !== null) && (
            <Text size="xs" c="dimmed">
              Reference: {data.refMin ?? '?'} - {data.refMax ?? '?'} {trendData.unit}
            </Text>
          )}

          <Text size="xs" c="dimmed">
            Lab: {data.testName}
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
      <Paper withBorder p="xl" radius="md" bg="gray.0">
        <Text size="sm" c="dimmed" ta="center">
          No data points to display
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Reference Range Legend */}
      {referenceRange && (referenceRange.min !== null || referenceRange.max !== null || referenceRange.text) && (
        <Paper withBorder p="xs" radius="md" bg="gray.0">
          <Group gap="xs">
            <Text size="xs" fw={600}>Reference Range:</Text>
            <Text size="xs">
              {referenceRange.text
                ? `${referenceRange.text} ${trendData.unit}`
                : `${referenceRange.min ?? '?'} - ${referenceRange.max ?? '?'} ${trendData.unit}`
              }
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />

            <XAxis
              dataKey="date"
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
              label={{ value: trendData.unit, angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              allowDataOverflow={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              iconType="line"
            />

            {/* Reference range area */}
            {referenceRange && referenceRange.min !== null && referenceRange.max !== null && (
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
                label={{ value: 'Min', position: 'right', fontSize: 10, fill: '#40c057' }}
              />
            )}

            {referenceRange && referenceRange.max !== null && (
              <ReferenceLine
                y={referenceRange.max}
                stroke="#40c057"
                strokeDasharray="3 3"
                label={{ value: 'Max', position: 'right', fontSize: 10, fill: '#40c057' }}
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
        <Badge size="sm" variant="light" color="green">Normal</Badge>
        <Badge size="sm" variant="light" color="orange">High/Low</Badge>
        <Badge size="sm" variant="light" color="red">Critical</Badge>
        <Badge size="sm" variant="light" color="yellow">Abnormal</Badge>
      </Group>
    </Stack>
  );
};

export default TestComponentTrendChart;
