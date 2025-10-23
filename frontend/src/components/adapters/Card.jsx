import React from 'react';
import { Card as MantineCard } from '@mantine/core';
import { CardHeader, CardTitle, CardContent } from '../ui/Card';

export const Card = ({ children, className, ...props }) => {

  return (
    <MantineCard
      shadow="sm"
      padding="lg"
      withBorder
      className={className}
      {...props}
    >
      {children}
    </MantineCard>
  );
};

// Keep the sub-components for backward compatibility
export { CardHeader, CardTitle, CardContent };

export default Card;
