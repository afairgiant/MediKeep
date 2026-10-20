import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Anchor, Badge, Group, Text } from '@mantine/core';
import type { SettingSource, SettingState, SettingValue } from './types';

interface SettingRowProps {
  label: string;
  description?: ReactNode;
  control: ReactNode;
  state?: SettingState;
  dirty?: boolean;
  pendingReset?: boolean;
  onReset?: () => void;
  formatValue?: (_value: SettingValue) => string;
  children?: ReactNode;
}

const SettingRow = ({
  label,
  description,
  control,
  state,
  dirty = false,
  pendingReset = false,
  onReset,
  formatValue = String,
  children,
}: SettingRowProps) => {
  const { t } = useTranslation('admin');

  const source: SettingSource | null = state
    ? pendingReset
      ? state.fallback_source
      : state.source
    : null;
  const sourceLabels: Record<SettingSource, string> = {
    saved: t('settings.source.saved', 'Saved here'),
    env: t('settings.source.env', 'From compose'),
    default: t('settings.source.default', 'Default'),
  };
  const composeOverridden =
    !!state &&
    !pendingReset &&
    state.source === 'saved' &&
    state.fallback_source === 'env' &&
    state.fallback !== state.value;

  return (
    <div className={`setting-row${dirty ? ' is-dirty' : ''}`}>
      <Text fw={500}>{label}</Text>
      <div className="setting-row-control">{control}</div>
      {description && (
        <Text size="sm" c="dimmed" component="div">
          {description}
        </Text>
      )}
      {source && (
        <Group gap="xs" className="setting-row-extra">
          <Badge variant="outline" color="gray" size="sm" fw={500}>
            {sourceLabels[source]}
          </Badge>
          {composeOverridden && (
            <Text size="xs" c="dimmed">
              {t(
                'settings.source.composeOverridden',
                'Compose sets {{value}}; the saved value is used instead.',
                { value: formatValue(state.fallback) }
              )}
            </Text>
          )}
          {source === 'saved' && onReset && (
            <Anchor
              component="button"
              type="button"
              size="xs"
              onClick={onReset}
            >
              {t('settings.source.reset', 'Reset to default')}
            </Anchor>
          )}
        </Group>
      )}
      {children && <div className="setting-row-extra">{children}</div>}
    </div>
  );
};

export default SettingRow;
