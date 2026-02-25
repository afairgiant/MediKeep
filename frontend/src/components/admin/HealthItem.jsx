import PropTypes from 'prop-types';
import { Group, Text, Badge, ThemeIcon } from '@mantine/core';

export const HEALTH_STATUS_COLORS = {
  healthy: 'green',
  ok: 'green',
  operational: 'green',
  warning: 'yellow',
  slow: 'yellow',
  error: 'red',
  unhealthy: 'red',
  failed: 'red',
  info: 'blue',
};

export function getHealthColor(status) {
  return HEALTH_STATUS_COLORS[status?.toLowerCase()] || 'blue';
}

const HealthItem = ({ label, value, status, icon: Icon, color }) => {
  const badgeColor = status ? getHealthColor(status) : null;

  return (
    <Group
      justify="space-between"
      py="sm"
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
    >
      <Group gap="sm">
        {Icon && (
          <ThemeIcon size="sm" variant="light" color={color || 'blue'}>
            <Icon size={14} />
          </ThemeIcon>
        )}
        <Text fw={500}>{label}</Text>
      </Group>
      {badgeColor ? (
        <Badge variant="light" color={badgeColor}>
          {value}
        </Badge>
      ) : (
        <Text c="dimmed">{value}</Text>
      )}
    </Group>
  );
};

HealthItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  status: PropTypes.string,
  icon: PropTypes.elementType,
  color: PropTypes.string,
};

export default HealthItem;
