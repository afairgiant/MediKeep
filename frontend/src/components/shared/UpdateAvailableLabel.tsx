import { Text } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface UpdateAvailableLabelProps {
  version: string | null;
  size?: MantineSize;
}

/** "(update available: vX)" in a highlight colour; renders nothing when version is null. */
const UpdateAvailableLabel = ({ version, size }: UpdateAvailableLabelProps) => {
  const { t } = useTranslation('settings');
  if (!version) return null;

  return (
    <Text component="span" size={size} c="orange" fw={500}>
      {t('system.version.updateAvailable', '(update available: {{version}})', {
        version,
      })}
    </Text>
  );
};

export default UpdateAvailableLabel;
