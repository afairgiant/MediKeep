import React from 'react';
import { Card as MantineCard } from '@mantine/core';
import OldCard, { CardHeader, CardTitle, CardContent } from '../ui/Card';

export const Card = ({ useMantine = true, children, className, ...props }) => {
  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldCard className={className} {...props}>
        {children}
      </OldCard>
    );
  }

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
