import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconHeart } from '@tabler/icons-react';
import HealthItem, { getHealthColor, HEALTH_STATUS_COLORS } from '../HealthItem';

const renderHealthItem = (props) => {
  return render(
    <MantineProvider>
      <HealthItem {...props} />
    </MantineProvider>
  );
};

describe('getHealthColor', () => {
  test('maps healthy statuses to green', () => {
    expect(getHealthColor('healthy')).toBe('green');
    expect(getHealthColor('ok')).toBe('green');
    expect(getHealthColor('operational')).toBe('green');
  });

  test('maps warning statuses to yellow', () => {
    expect(getHealthColor('warning')).toBe('yellow');
    expect(getHealthColor('slow')).toBe('yellow');
  });

  test('maps error statuses to red', () => {
    expect(getHealthColor('error')).toBe('red');
    expect(getHealthColor('unhealthy')).toBe('red');
    expect(getHealthColor('failed')).toBe('red');
  });

  test('maps info to blue', () => {
    expect(getHealthColor('info')).toBe('blue');
  });

  test('is case-insensitive', () => {
    expect(getHealthColor('HEALTHY')).toBe('green');
    expect(getHealthColor('Warning')).toBe('yellow');
    expect(getHealthColor('ERROR')).toBe('red');
    expect(getHealthColor('Ok')).toBe('green');
  });

  test('defaults to blue for unknown statuses', () => {
    expect(getHealthColor('unknown')).toBe('blue');
    expect(getHealthColor('something')).toBe('blue');
    expect(getHealthColor('')).toBe('blue');
  });

  test('handles null and undefined', () => {
    expect(getHealthColor(null)).toBe('blue');
    expect(getHealthColor(undefined)).toBe('blue');
  });
});

describe('HEALTH_STATUS_COLORS', () => {
  test('contains all expected keys', () => {
    const expectedKeys = [
      'healthy', 'ok', 'operational',
      'warning', 'slow',
      'error', 'unhealthy', 'failed',
      'info',
    ];
    expectedKeys.forEach(key => {
      expect(HEALTH_STATUS_COLORS).toHaveProperty(key);
    });
  });
});

describe('HealthItem', () => {
  test('renders label and value', () => {
    renderHealthItem({ label: 'Status', value: 'Active' });

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('renders value as Badge when status is provided', () => {
    renderHealthItem({ label: 'DB', value: 'Healthy', status: 'healthy' });

    const badge = screen.getByText('Healthy');
    expect(badge.closest('.mantine-Badge-root')).toBeInTheDocument();
  });

  test('renders value as plain Text when no status', () => {
    renderHealthItem({ label: 'Count', value: '42' });

    const text = screen.getByText('42');
    expect(text.closest('.mantine-Badge-root')).toBeNull();
  });

  test('renders numeric values', () => {
    renderHealthItem({ label: 'Records', value: 100 });

    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('renders icon when provided', () => {
    renderHealthItem({
      label: 'Health',
      value: 'Good',
      icon: IconHeart,
      color: 'red',
    });

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(document.querySelector('.mantine-ThemeIcon-root')).toBeInTheDocument();
  });
});
