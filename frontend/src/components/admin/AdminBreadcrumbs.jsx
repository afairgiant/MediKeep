import { Link, useLocation } from 'react-router-dom';
import { Breadcrumbs, Anchor, Text, Box } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { generateAdminBreadcrumbs } from '../../utils/adminBreadcrumbs';

const AdminBreadcrumbs = () => {
  const { pathname } = useLocation();
  const crumbs = generateAdminBreadcrumbs(pathname);

  // Hide breadcrumbs on dashboard root (single crumb only)
  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <Box
      px="md"
      py="sm"
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
    >
      <Breadcrumbs
        separator={<IconChevronRight size={14} color="var(--mantine-color-dimmed)" />}
      >
        {crumbs.map((crumb, index) =>
          crumb.path ? (
            <Anchor
              key={index}
              component={Link}
              to={crumb.path}
              size="sm"
              c="dimmed"
              underline="hover"
            >
              {crumb.label}
            </Anchor>
          ) : (
            <Text key={index} size="sm" fw={500}>
              {crumb.label}
            </Text>
          )
        )}
      </Breadcrumbs>
    </Box>
  );
};

export default AdminBreadcrumbs;
