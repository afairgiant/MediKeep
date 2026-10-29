import { Text } from '@mantine/core';
import { useDeviceName } from '../../hooks/useDeviceName';

interface DeviceLabelProps {
  userAgent: string | null | undefined;
}

/** The browser and system an entry came from, with the raw user agent on hover. */
const DeviceLabel = ({ userAgent }: DeviceLabelProps) => {
  const deviceName = useDeviceName();
  if (!userAgent) {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }
  return (
    <Text size="sm" title={userAgent} style={{ whiteSpace: 'nowrap' }}>
      {deviceName(userAgent)}
    </Text>
  );
};

export default DeviceLabel;
