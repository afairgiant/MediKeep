import type { ReactNode } from 'react';
import { Paper, Text } from '@mantine/core';

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
}

const SettingsGroup = ({ title, children }: SettingsGroupProps) => (
  <Paper withBorder radius="md">
    <Text
      size="xs"
      fw={600}
      tt="uppercase"
      c="dimmed"
      px="md"
      pt="sm"
      style={{ letterSpacing: '0.06em' }}
    >
      {title}
    </Text>
    {children}
  </Paper>
);

export default SettingsGroup;
