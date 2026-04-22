import { Card, Group, Text } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/admin/AdminLayout';
import PracticesList from '../../components/medical/practitioners/PracticesList';

const PracticesAdmin = () => {
  const { t } = useTranslation(['admin', 'shared']);

  return (
    <AdminLayout>
      <Card shadow="sm" p="xl" mb="xl" withBorder>
        <Group align="center" mb="xs">
          <IconBuilding size={32} aria-hidden="true" />
          <Text size="xl" fw={700}>
            {t('admin:practices.title', 'Practices')}
          </Text>
        </Group>
        <Text c="dimmed" size="md">
          {t(
            'admin:practices.subtitle',
            'Manage medical practices — contact details, locations, and more.'
          )}
        </Text>
      </Card>
      <PracticesList />
    </AdminLayout>
  );
};

export default PracticesAdmin;
