import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Title, Text, Button, Stack } from '@mantine/core';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import { useResponsive } from '../../hooks/useResponsive';

const DashboardCard = ({ title, description, link, size = 'normal' }) => {
  const navigate = useNavigate();
  const responsive = useResponsive();

  const handleClick = () => {
    navigate(link);
  };

  // Create responsive versions of Mantine components
  const ResponsiveCard = ResponsiveComponentFactory.createMantine(Card, {
    shadow: { xs: 'xs', md: 'sm', lg: 'md' },
    padding: { xs: 'sm', md: 'md', lg: 'lg' },
    radius: { xs: 'xs', md: 'sm' },
    withBorder: { xs: true, lg: false }
  });

  const ResponsiveTitle = ResponsiveComponentFactory.createMantine(Title, {
    order: { xs: 4, sm: 3, md: 3, lg: 2 },
    size: { xs: 'h4', sm: 'h3', lg: 'h2' }
  });

  const ResponsiveText = ResponsiveComponentFactory.createMantine(Text, {
    size: { xs: 'sm', md: 'md' },
    lineClamp: { xs: 3, md: 2 }
  });

  const ResponsiveButton = ResponsiveComponentFactory.createMantine(Button, {
    size: { xs: 'sm', md: 'md', lg: 'lg' },
    fullWidth: { xs: true, md: size === 'small', lg: false },
    variant: { xs: 'filled', lg: 'outline' }
  });

  // Adjust spacing based on screen size
  const spacing = responsive.isMobile ? 'xs' : responsive.isTablet ? 'sm' : 'md';

  return (
    <ResponsiveCard h={size === 'small' ? { xs: 160, md: 140 } : { xs: 200, md: 180, lg: 160 }}>
      <Stack spacing={spacing} h="100%" justify="space-between">
        <Stack spacing="xs">
          <ResponsiveTitle>
            {title}
          </ResponsiveTitle>
          <ResponsiveText color="dimmed">
            {description}
          </ResponsiveText>
        </Stack>
        
        <ResponsiveButton onClick={handleClick}>
          {title.includes('View') ? title.split(' ')[1] : 'Access'}
        </ResponsiveButton>
      </Stack>
    </ResponsiveCard>
  );
};

export default DashboardCard;
