/**
 * ResponsiveGrid - Responsive grid component
 * Provides consistent responsive grid behavior using Mantine SimpleGrid
 * 
 * Following PR #3: Navigation & Layout System specifications
 * File specified in RESPONSIVE_IMPLEMENTATION_PLAN.md line 257
 */

import React from 'react';
import { SimpleGrid, Box } from '@mantine/core';
import { ResponsiveComponentFactory } from '../../factories/ResponsiveComponentFactory';
import { GridLayoutStrategy } from '../../strategies/GridLayoutStrategy';
import { useResponsive } from '../../hooks/useResponsive';
import './ResponsiveGrid.css';

const ResponsiveGrid = ({
  children,
  columns = { xs: 1, sm: 2, md: 2, lg: 3, xl: 4 },
  spacing = { xs: 'xs', sm: 'sm', md: 'md', lg: 'lg' },
  verticalSpacing,
  minChildWidth,
  maxChildWidth,
  strategy = 'default',
  className = '',
  ...props
}) => {
  const responsive = useResponsive();
  
  // Initialize grid strategy
  const gridStrategy = React.useMemo(() => {
    return new GridLayoutStrategy({
      grid: {
        minItemWidth: minChildWidth || 250,
        maxColumns: Math.max(...Object.values(columns)),
        adaptiveColumns: true,
        maintainAspectRatio: strategy === 'thumbnails'
      }
    });
  }, [minChildWidth, columns, strategy]);

  // Get responsive grid configuration
  const gridConfig = React.useMemo(() => {
    return gridStrategy.getSimpleGridProps(responsive.breakpoint, {
      itemCount: React.Children.count(children),
      containerWidth: responsive.width,
      customColumns: columns,
      customSpacing: spacing
    });
  }, [gridStrategy, responsive.breakpoint, responsive.width, children, columns, spacing]);

  // Create responsive SimpleGrid
  const ResponsiveSimpleGrid = ResponsiveComponentFactory.createMantine(SimpleGrid, {
    cols: columns,
    spacing: spacing,
    verticalSpacing: verticalSpacing || spacing
  });

  // Create responsive wrapper
  const ResponsiveWrapper = ResponsiveComponentFactory.createMantine(Box, {
    className: `responsive-grid responsive-grid-${strategy} ${className}`
  });

  return (
    <ResponsiveWrapper>
      <ResponsiveSimpleGrid
        {...gridConfig}
        {...props}
        breakpoints={[
          { maxWidth: 'sm', cols: columns.xs || 1 },
          { maxWidth: 'md', cols: columns.sm || 2 },
          { maxWidth: 'lg', cols: columns.md || 2 },
          { maxWidth: 'xl', cols: columns.lg || 3 }
        ]}
      >
        {children}
      </ResponsiveSimpleGrid>
    </ResponsiveWrapper>
  );
};

// Pre-configured grid variants for common use cases
export const CardGrid = (props) => (
  <ResponsiveGrid
    columns={{ xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
    spacing={{ xs: 'sm', md: 'md', lg: 'lg' }}
    minChildWidth={280}
    strategy="cards"
    {...props}
  />
);

export const ThumbnailGrid = (props) => (
  <ResponsiveGrid
    columns={{ xs: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
    spacing={{ xs: 'xs', sm: 'sm', md: 'md' }}
    minChildWidth={150}
    strategy="thumbnails"
    {...props}
  />
);

export const DashboardGrid = (props) => (
  <ResponsiveGrid
    columns={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
    spacing={{ xs: 'md', md: 'lg', lg: 'xl' }}
    minChildWidth={320}
    strategy="dashboard"
    {...props}
  />
);

export default ResponsiveGrid;