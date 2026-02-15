/**
 * VitalTrendChart component
 * Displays historical trend data for a specific vital sign as a line chart
 * Uses Recharts for visualization
 *
 * Supports both raw data display and aggregated data with min/max range bands
 */

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Paper, Stack, Text, Group, Badge } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { VitalTrendResponse, VitalDataPoint, AggregatedDataPoint, AggregationPeriod } from './types';
import { convertToChartData } from '../../../utils/vitalDataAggregation';
import { generateYAxisConfig } from '../../../utils/chartAxisUtils';

interface VitalTrendChartProps {
  trendData: VitalTrendResponse;
  aggregatedDataPoints?: AggregatedDataPoint[];
  aggregationPeriod?: AggregationPeriod | null;
}

const VitalTrendChart: React.FC<VitalTrendChartProps> = ({
  trendData,
  aggregatedDataPoints = [],
  aggregationPeriod = null
}) => {
  const { t } = useTranslation('common');

  // Determine if we're displaying aggregated data
  const isAggregated = aggregationPeriod !== null && aggregatedDataPoints.length > 0;

  // Check if this vital type has secondary values (e.g., blood pressure with systolic/diastolic)
  const hasSecondaryValue = useMemo(() => {
    if (isAggregated) {
      return aggregatedDataPoints.some(
        (point) => point.secondaryAverage !== null && point.secondaryAverage !== undefined
      );
    }
    return trendData.data_points.some(
      (point) => point.secondary_value !== null && point.secondary_value !== undefined
    );
  }, [trendData.data_points, aggregatedDataPoints, isAggregated]);

  const chartData = useMemo(() => {
    if (isAggregated) {
      // Use aggregated data for display
      return convertToChartData(aggregatedDataPoints);
    }

    // Use raw data points
    return trendData.data_points.map((point: VitalDataPoint) => {
      const dateStr = point.recorded_date.split('T')[0];

      return {
        date: dateStr,
        value: point.value,
        secondaryValue: point.secondary_value
      };
    }).reverse(); // Reverse to show oldest first (left to right)
  }, [trendData.data_points, aggregatedDataPoints, isAggregated]);

  // Calculate Y-axis configuration with nice, rounded tick values
  const yAxisConfig = useMemo(() => {
    const primaryValues = chartData.map((d: { value: number }) => d.value);
    const secondaryValues = chartData
      .map((d: { secondaryValue?: number | null }) => d.secondaryValue)
      .filter((v): v is number => v != null);

    // For aggregated data, also consider min/max values for proper axis range
    let aggregatedBounds: number[] = [];
    if (isAggregated) {
      const numericFields = ['min', 'max', 'secondaryMin', 'secondaryMax'] as const;
      aggregatedBounds = numericFields.flatMap(field =>
        chartData.map((d: any) => d[field]).filter((v): v is number => v != null)
      );
    }

    return generateYAxisConfig([...primaryValues, ...secondaryValues, ...aggregatedBounds]);
  }, [chartData, isAggregated]);

  // Custom dot renderer for primary data points (systolic for BP)
  const renderPrimaryDot = (props: any): React.ReactElement => {
    const { cx, cy } = props;
    return <circle cx={cx} cy={cy} r={4} fill="#228be6" stroke="#fff" strokeWidth={2} />;
  };

  // Custom dot renderer for secondary data points (diastolic for BP)
  const renderSecondaryDot = (props: any): React.ReactElement => {
    const { cx, cy } = props;
    return <circle cx={cx} cy={cy} r={4} fill="#fa5252" stroke="#fff" strokeWidth={2} />;
  };

  // Get labels for blood pressure or other dual-value vitals
  const getPrimaryLabel = () => {
    if (trendData.vital_type === 'blood_pressure') {
      return t('vitals.systolic', 'Systolic');
    }
    return trendData.vital_type_label;
  };

  const getSecondaryLabel = () => {
    if (trendData.vital_type === 'blood_pressure') {
      return t('vitals.diastolic', 'Diastolic');
    }
    return t('vitals.secondary', 'Secondary');
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <Paper withBorder p="sm" shadow="md" radius="md" bg="white">
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {isAggregated && data.periodLabel ? data.periodLabel : data.date}
          </Text>

          {isAggregated && data.count && (
            <Badge size="sm" variant="light" color="gray">
              {data.count} {t('vitals.trends.readings', 'readings')}
            </Badge>
          )}

          {hasSecondaryValue ? (
            <>
              <Group gap="xs" align="baseline">
                <Text size="sm" c="blue" fw={600}>{getPrimaryLabel()}:</Text>
                <Text size="lg" fw={700} c="blue">
                  {isAggregated ? Math.round(data.value) : data.value}
                </Text>
                <Text size="sm" c="dimmed">{trendData.unit}</Text>
              </Group>
              {isAggregated && data.min !== undefined && data.max !== undefined && (
                <Text size="xs" c="dimmed">
                  {t('vitals.trends.range', 'Range')}: {Math.round(data.min)} - {Math.round(data.max)}
                </Text>
              )}
              {data.secondaryValue !== null && data.secondaryValue !== undefined && (
                <>
                  <Group gap="xs" align="baseline">
                    <Text size="sm" c="red" fw={600}>{getSecondaryLabel()}:</Text>
                    <Text size="lg" fw={700} c="red">
                      {isAggregated ? Math.round(data.secondaryValue) : data.secondaryValue}
                    </Text>
                    <Text size="sm" c="dimmed">{trendData.unit}</Text>
                  </Group>
                  {isAggregated && data.secondaryMin !== undefined && data.secondaryMax !== undefined && (
                    <Text size="xs" c="dimmed">
                      {t('vitals.trends.range', 'Range')}: {Math.round(data.secondaryMin)} - {Math.round(data.secondaryMax)}
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Group gap="xs" align="baseline">
                <Text size="lg" fw={700} c="blue">
                  {isAggregated ? Math.round(data.value) : data.value}
                </Text>
                <Text size="sm" c="dimmed">{trendData.unit}</Text>
              </Group>
              {isAggregated && data.min !== undefined && data.max !== undefined && (
                <Text size="xs" c="dimmed">
                  {t('vitals.trends.range', 'Range')}: {Math.round(data.min)} - {Math.round(data.max)}
                </Text>
              )}
            </>
          )}
        </Stack>
      </Paper>
    );
  };

  if (chartData.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="gray.0">
        <Text size="sm" c="dimmed" ta="center">
          {t('vitals.trends.noDataPoints', 'No data points to display')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
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

          {/* Max line for aggregated data (dashed reference) */}
          {isAggregated && (
            <Line
              type="monotone"
              dataKey="max"
              stroke="#228be6"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              legendType="none"
            />
          )}

          {/* Primary value line (systolic for BP or average for aggregated) */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#228be6"
            strokeWidth={2}
            dot={isAggregated ? { r: 3, fill: '#228be6', stroke: '#fff', strokeWidth: 1 } : renderPrimaryDot}
            name={hasSecondaryValue ? getPrimaryLabel() : trendData.vital_type_label}
            connectNulls
          />

          {/* Min line for aggregated data */}
          {isAggregated && (
            <Line
              type="monotone"
              dataKey="min"
              stroke="#228be6"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name={t('vitals.trends.rangeMin', 'Min')}
              legendType="none"
            />
          )}

          {/* Max line for secondary values (diastolic) when aggregated */}
          {isAggregated && hasSecondaryValue && (
            <Line
              type="monotone"
              dataKey="secondaryMax"
              stroke="#fa5252"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              legendType="none"
            />
          )}

          {/* Secondary value line (diastolic for BP) - only shown when secondary values exist */}
          {hasSecondaryValue && (
            <Line
              type="monotone"
              dataKey="secondaryValue"
              stroke="#fa5252"
              strokeWidth={2}
              dot={isAggregated ? { r: 3, fill: '#fa5252', stroke: '#fff', strokeWidth: 1 } : renderSecondaryDot}
              name={getSecondaryLabel()}
              connectNulls
            />
          )}

          {/* Min line for secondary values when aggregated */}
          {isAggregated && hasSecondaryValue && (
            <Line
              type="monotone"
              dataKey="secondaryMin"
              stroke="#fa5252"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              legendType="none"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  );
};

export default VitalTrendChart;
