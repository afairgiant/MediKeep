import LayoutStrategy from './LayoutStrategy';
import { RESPONSIVE_VALUES } from '../config/responsive.config';

/**
 * GridLayoutStrategy
 * Concrete implementation of LayoutStrategy for grid-based layouts
 * 
 * Provides responsive grid calculations optimized for:
 * - Card grids
 * - Data displays
 * - Dashboard layouts
 * - Gallery views
 * - Any uniform grid layouts
 */
export class GridLayoutStrategy extends LayoutStrategy {
  constructor(config = {}) {
    super({
      name: 'GridLayoutStrategy',
      priority: 1,
      ...config
    });

    // Default grid configuration
    this.gridConfig = {
      minItemWidth: 250, // Minimum item width in pixels
      maxColumns: 6,     // Maximum columns regardless of screen size
      adaptiveColumns: true, // Whether to adapt based on item count
      maintainAspectRatio: true,
      ...config.grid
    };
  }

  /**
   * Calculate optimal number of columns for grid layout
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {number} Number of columns
   */
  getColumns(breakpoint, context = {}) {
    const { 
      itemCount = 0, 
      containerWidth = 0, 
      minItemWidth = this.gridConfig.minItemWidth,
      maxColumns = this.gridConfig.maxColumns,
      forceColumns = null 
    } = context;

    // If columns are explicitly specified, use those
    if (forceColumns !== null && forceColumns > 0) {
      return Math.min(forceColumns, maxColumns);
    }

    // Base columns from responsive configuration
    const baseColumns = this.getResponsiveValue(
      breakpoint, 
      RESPONSIVE_VALUES.gridColumns,
      this.getDefaultColumns(breakpoint)
    );

    // If adaptive columns is disabled, return base columns
    if (!this.gridConfig.adaptiveColumns) {
      return Math.min(baseColumns, maxColumns);
    }

    // Adaptive calculation based on container width
    if (containerWidth > 0) {
      const calculatedColumns = Math.floor(containerWidth / minItemWidth);
      const adaptiveColumns = Math.min(calculatedColumns, baseColumns, maxColumns);
      return Math.max(adaptiveColumns, 1);
    }

    // Adaptive calculation based on item count
    if (itemCount > 0) {
      const itemBasedColumns = Math.min(itemCount, baseColumns, maxColumns);
      return Math.max(itemBasedColumns, 1);
    }

    // Fallback to base columns
    return Math.min(baseColumns, maxColumns);
  }

  /**
   * Get default columns for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Default column count
   */
  getDefaultColumns(breakpoint) {
    const defaults = {
      xs: 1,
      sm: 2,
      md: 2,
      lg: 3,
      xl: 4,
      xxl: 4
    };

    return defaults[breakpoint] || 2;
  }

  /**
   * Get spacing configuration for grid
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {string} Spacing value
   */
  getSpacing(breakpoint, context = {}) {
    const { dense = false, customSpacing } = context;

    // Custom spacing override
    if (customSpacing && customSpacing[breakpoint]) {
      return customSpacing[breakpoint];
    }

    // Dense spacing for compact layouts
    if (dense) {
      const denseSpacing = {
        xs: 'xs',
        sm: 'xs',
        md: 'sm',
        lg: 'sm', 
        xl: 'md',
        xxl: 'md'
      };
      return denseSpacing[breakpoint] || 'sm';
    }

    // Default responsive spacing
    return this.getResponsiveValue(
      breakpoint,
      RESPONSIVE_VALUES.gutter,
      this.getDefaultSpacing(breakpoint)
    );
  }

  /**
   * Get default spacing for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Default spacing value
   */
  getDefaultSpacing(breakpoint) {
    const defaults = {
      xs: 'xs',
      sm: 'sm',
      md: 'md',
      lg: 'md',
      xl: 'lg',
      xxl: 'lg'
    };

    return defaults[breakpoint] || 'md';
  }

  /**
   * Get container configuration for grid
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Container configuration
   */
  getContainer(breakpoint, context = {}) {
    const { 
      fluid = false, 
      centered = true,
      maxWidth = null 
    } = context;

    const config = {
      fluid,
      centered,
      padding: this.getContainerPadding(breakpoint),
      size: this.getContainerSize(breakpoint)
    };

    if (maxWidth) {
      config.maxWidth = maxWidth;
    }

    return config;
  }

  /**
   * Get container padding for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Container padding
   */
  getContainerPadding(breakpoint) {
    const padding = {
      xs: 'sm',
      sm: 'sm',
      md: 'md',
      lg: 'md',
      xl: 'lg',
      xxl: 'lg'
    };

    return padding[breakpoint] || 'md';
  }

  /**
   * Get container size for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Container size
   */
  getContainerSize(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      RESPONSIVE_VALUES.containerWidth,
      this.getDefaultContainerSize(breakpoint)
    );
  }

  /**
   * Get default container size for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Default container size
   */
  getDefaultContainerSize(breakpoint) {
    const sizes = {
      xs: 'xs',
      sm: 'sm',
      md: 'md',
      lg: 'lg',
      xl: 'xl',
      xxl: 'xl'
    };

    return sizes[breakpoint] || 'md';
  }

  /**
   * Calculate item dimensions for grid
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Item dimensions
   */
  getItemDimensions(breakpoint, context = {}) {
    const columns = this.getColumns(breakpoint, context);
    const spacing = this.getSpacing(breakpoint, context);
    const { containerWidth = 0, aspectRatio = null } = context;

    const dimensions = {
      columns,
      spacing
    };

    if (containerWidth > 0) {
      // Calculate item width based on container width and columns
      const spacingPixels = this.convertSpacingToPixels(spacing);
      const totalSpacing = spacingPixels * (columns - 1);
      const availableWidth = containerWidth - totalSpacing;
      const itemWidth = availableWidth / columns;

      dimensions.width = Math.floor(itemWidth);

      if (aspectRatio && this.gridConfig.maintainAspectRatio) {
        dimensions.height = Math.floor(itemWidth / aspectRatio);
      }
    }

    return dimensions;
  }

  /**
   * Convert Mantine spacing string to approximate pixels
   * 
   * @param {string} spacing - Mantine spacing value
   * @returns {number} Approximate pixels
   */
  convertSpacingToPixels(spacing) {
    const spacingMap = {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32
    };

    return spacingMap[spacing] || 16;
  }

  /**
   * Get complete grid configuration
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Complete grid configuration
   */
  getGridConfig(breakpoint, context = {}) {
    const baseConfig = this.getLayoutConfig(breakpoint, context);
    const itemDimensions = this.getItemDimensions(breakpoint, context);

    return {
      ...baseConfig,
      itemDimensions,
      type: 'grid',
      strategy: 'GridLayoutStrategy'
    };
  }

  /**
   * Check if this strategy should be used for the given context
   * 
   * @param {Object} context - Context to check
   * @returns {boolean} True if strategy should be used
   */
  shouldUse(context = {}) {
    const { layoutType, componentType } = context;

    // Explicitly requested
    if (layoutType === 'grid') {
      return true;
    }

    // Component types that work well with grid layout
    const gridCompatibleComponents = [
      'card',
      'item',
      'thumbnail',
      'tile',
      'gallery',
      'dashboard',
      'grid'
    ];

    if (componentType && gridCompatibleComponents.includes(componentType.toLowerCase())) {
      return true;
    }

    // Default to true for general use
    return true;
  }

  /**
   * Transform props for grid-based component
   * 
   * @param {Object} props - Original props
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Transformed props
   */
  transformProps(props, breakpoint, context = {}) {
    const gridConfig = this.getGridConfig(breakpoint, context);
    
    return {
      ...props,
      cols: gridConfig.columns,
      spacing: gridConfig.spacing,
      gridConfig,
      responsive: {
        breakpoint,
        ...gridConfig
      }
    };
  }

  /**
   * Get responsive breakpoints configuration for CSS Grid
   * 
   * @param {Object} context - Additional context
   * @returns {Object} CSS Grid responsive configuration
   */
  getCSSGridConfig(context = {}) {
    const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
    const config = {};

    breakpoints.forEach(breakpoint => {
      const columns = this.getColumns(breakpoint, context);
      const spacing = this.getSpacing(breakpoint, context);
      
      config[breakpoint] = {
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: this.convertSpacingToPixels(spacing) + 'px'
      };
    });

    return config;
  }

  /**
   * Get Mantine SimpleGrid props
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} SimpleGrid props
   */
  getSimpleGridProps(breakpoint, context = {}) {
    return {
      cols: this.getColumns(breakpoint, context),
      spacing: this.getSpacing(breakpoint, context),
      verticalSpacing: this.getSpacing(breakpoint, context),
      breakpoints: this.getBreakpointsConfig(context)
    };
  }

  /**
   * Get breakpoints configuration for Mantine SimpleGrid
   * 
   * @param {Object} context - Additional context
   * @returns {Array} Breakpoints configuration
   */
  getBreakpointsConfig(context = {}) {
    return [
      { maxWidth: 'sm', cols: this.getColumns('xs', context) },
      { maxWidth: 'md', cols: this.getColumns('sm', context) },
      { maxWidth: 'lg', cols: this.getColumns('md', context) },
      { maxWidth: 'xl', cols: this.getColumns('lg', context) }
    ];
  }
}

/**
 * Create a pre-configured grid strategy for common use cases
 */
export function createGridStrategy(config = {}) {
  return new GridLayoutStrategy(config);
}

/**
 * Pre-defined grid strategies for common layouts
 */
export const GRID_STRATEGIES = {
  // Card grid strategy
  cards: createGridStrategy({
    grid: {
      minItemWidth: 280,
      maxColumns: 4,
      adaptiveColumns: true,
      maintainAspectRatio: false
    }
  }),

  // Thumbnail grid strategy  
  thumbnails: createGridStrategy({
    grid: {
      minItemWidth: 150,
      maxColumns: 6,
      adaptiveColumns: true,
      maintainAspectRatio: true
    }
  }),

  // Dashboard widget strategy
  dashboard: createGridStrategy({
    grid: {
      minItemWidth: 320,
      maxColumns: 3,
      adaptiveColumns: false,
      maintainAspectRatio: false
    }
  }),

  // Dense layout strategy
  dense: createGridStrategy({
    grid: {
      minItemWidth: 200,
      maxColumns: 5,
      adaptiveColumns: true,
      maintainAspectRatio: false
    }
  })
};

export default GridLayoutStrategy;