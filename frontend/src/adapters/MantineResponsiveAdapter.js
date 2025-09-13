import { BREAKPOINTS } from '../config/responsive.config';

/**
 * MantineResponsiveAdapter
 * Bridges our custom responsive system with Mantine UI components
 * 
 * Provides utilities to:
 * - Convert custom breakpoints to Mantine breakpoints
 * - Transform responsive config to Mantine props
 * - Handle Mantine-specific responsive patterns
 * - Optimize Mantine component performance
 */
export class MantineResponsiveAdapter {
  /**
   * Map our custom breakpoints to Mantine's breakpoint system
   * Mantine uses: xs, sm, md, lg, xl (same as ours, convenient!)
   */
  static BREAKPOINT_MAP = {
    xs: 'xs',
    sm: 'sm', 
    md: 'md',
    lg: 'lg',
    xl: 'xl',
    xxl: 'xl' // Map our xxl to Mantine's xl
  };

  /**
   * Convert custom breakpoint to Mantine breakpoint
   * 
   * @param {string} customBreakpoint - Our breakpoint name
   * @returns {string} Mantine breakpoint name
   * 
   * @example
   * MantineResponsiveAdapter.toMantineBreakpoint('xs') // 'xs'
   * MantineResponsiveAdapter.toMantineBreakpoint('xxl') // 'xl'
   */
  static toMantineBreakpoint(customBreakpoint) {
    return this.BREAKPOINT_MAP[customBreakpoint] || 'md';
  }

  /**
   * Convert responsive config to Mantine Grid props
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Responsive configuration
   * @returns {Object} Mantine Grid props
   * 
   * @example
   * const gridProps = MantineResponsiveAdapter.toMantineGrid('md', {
   *   columns: 3,
   *   spacing: 'md',
   *   offset: 1
   * });
   * // Returns: { span: 3, offset: 1 }
   */
  static toMantineGrid(breakpoint, config = {}) {
    const { columns, offset = 0, order } = config;
    
    const gridProps = {};
    
    if (columns !== undefined) {
      gridProps.span = columns;
    }
    
    if (offset !== undefined && offset > 0) {
      gridProps.offset = offset;
    }
    
    if (order !== undefined) {
      gridProps.order = order;
    }
    
    return gridProps;
  }

  /**
   * Transform responsive configuration to Mantine-compatible format
   * 
   * @param {Object} responsiveConfig - Our responsive config
   * @returns {Object} Mantine-compatible responsive props
   * 
   * @example
   * const config = {
   *   columns: { xs: 1, sm: 2, md: 3, lg: 4 },
   *   spacing: { xs: 'xs', md: 'md', lg: 'lg' }
   * };
   * const mantineProps = MantineResponsiveAdapter.transformConfig(config);
   */
  static transformConfig(responsiveConfig = {}) {
    const mantineProps = {};
    
    Object.entries(responsiveConfig).forEach(([propName, breakpointValues]) => {
      if (typeof breakpointValues === 'object' && breakpointValues !== null) {
        // Transform breakpoint values to Mantine format
        const mantineBreakpointValues = {};
        
        Object.entries(breakpointValues).forEach(([breakpoint, value]) => {
          const mantineBreakpoint = this.toMantineBreakpoint(breakpoint);
          mantineBreakpointValues[mantineBreakpoint] = value;
        });
        
        mantineProps[propName] = mantineBreakpointValues;
      } else {
        // Static value, pass through
        mantineProps[propName] = breakpointValues;
      }
    });
    
    return mantineProps;
  }

  /**
   * Create responsive Mantine Modal props
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Modal configuration
   * @returns {Object} Mantine Modal props
   * 
   * @example
   * const modalProps = MantineResponsiveAdapter.createModalProps('xs', {
   *   enableFullScreen: true,
   *   centerOnDesktop: true
   * });
   */
  static createModalProps(breakpoint, config = {}) {
    const { 
      enableFullScreen = false, 
      centerOnDesktop = true,
      customSize = {} 
    } = config;
    
    const props = {};
    
    // Handle responsive sizing
    if (customSize[breakpoint]) {
      props.size = customSize[breakpoint];
    } else {
      // Default responsive behavior
      switch (breakpoint) {
        case 'xs':
        case 'sm':
          props.size = enableFullScreen ? 'full' : 'lg';
          props.fullScreen = enableFullScreen;
          break;
        case 'md':
          props.size = 'lg';
          props.fullScreen = false;
          break;
        default:
          props.size = 'md';
          props.fullScreen = false;
      }
    }
    
    // Handle centering
    props.centered = breakpoint === 'xs' || breakpoint === 'sm' ? false : centerOnDesktop;
    
    return props;
  }

  /**
   * Create responsive Mantine Select/Autocomplete props
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Select configuration
   * @returns {Object} Mantine Select props
   * 
   * @example
   * const selectProps = MantineResponsiveAdapter.createSelectProps('xs', {
   *   optimizeForMobile: true,
   *   maxItems: 100
   * });
   */
  static createSelectProps(breakpoint, config = {}) {
    const {
      optimizeForMobile = true,
      maxItems = 50,
      enableVirtualization = false
    } = config;
    
    const props = {};
    
    // Mobile optimizations
    if (optimizeForMobile && (breakpoint === 'xs' || breakpoint === 'sm')) {
      props.searchable = false; // Reduce complexity on mobile
      props.limit = Math.min(maxItems, 25); // Reduce dropdown size
      props.maxDropdownHeight = 200; // Smaller dropdown
      props.withinPortal = true; // Better mobile positioning
    } else {
      props.searchable = true;
      props.limit = maxItems;
      props.maxDropdownHeight = 280;
      props.withinPortal = false; // Better desktop performance
    }
    
    // Virtualization for large lists
    if (enableVirtualization && maxItems > 100) {
      props.withScrollArea = true;
    }
    
    return props;
  }

  /**
   * Create responsive Mantine Table props
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Table configuration
   * @returns {Object} Mantine Table props and additional config
   * 
   * @example
   * const tableConfig = MantineResponsiveAdapter.createTableProps('xs', {
   *   enableHorizontalScroll: true,
   *   priorityColumns: ['name', 'date']
   * });
   */
  static createTableProps(breakpoint, config = {}) {
    const {
      enableHorizontalScroll = true,
      priorityColumns = [],
      compactOnMobile = true
    } = config;
    
    const props = {};
    const additionalConfig = {};
    
    if (breakpoint === 'xs' || breakpoint === 'sm') {
      // Mobile table optimizations
      props.fontSize = 'sm';
      props.verticalSpacing = compactOnMobile ? 'xs' : 'sm';
      props.horizontalSpacing = compactOnMobile ? 'xs' : 'sm';
      
      if (enableHorizontalScroll) {
        additionalConfig.enableScroll = true;
        additionalConfig.minWidth = '600px'; // Force horizontal scroll
      }
      
      additionalConfig.priorityColumns = priorityColumns;
      additionalConfig.hiddenColumns = []; // Columns to hide on mobile
    } else {
      // Desktop table
      props.fontSize = 'md';
      props.verticalSpacing = 'md';
      props.horizontalSpacing = 'md';
      additionalConfig.enableScroll = false;
    }
    
    return { props, config: additionalConfig };
  }

  /**
   * Get Mantine spacing value for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} spacingConfig - Spacing configuration
   * @returns {string} Mantine spacing value
   */
  static getSpacing(breakpoint, spacingConfig = {}) {
    const defaultSpacing = {
      xs: 'xs',
      sm: 'sm', 
      md: 'md',
      lg: 'lg',
      xl: 'xl',
      xxl: 'xl'
    };
    
    return spacingConfig[breakpoint] || defaultSpacing[breakpoint] || 'md';
  }

  /**
   * Get Mantine size value for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} sizeConfig - Size configuration
   * @returns {string} Mantine size value
   */
  static getSize(breakpoint, sizeConfig = {}) {
    const defaultSizes = {
      xs: 'sm',
      sm: 'sm',
      md: 'md', 
      lg: 'md',
      xl: 'lg',
      xxl: 'lg'
    };
    
    return sizeConfig[breakpoint] || defaultSizes[breakpoint] || 'md';
  }

  /**
   * Create responsive container props for Mantine Container component
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Container configuration
   * @returns {Object} Mantine Container props
   */
  static createContainerProps(breakpoint, config = {}) {
    const { fluid = false, sizes = {} } = config;
    
    const props = {};
    
    if (fluid) {
      props.fluid = true;
    } else {
      // Responsive container sizes
      const defaultSizes = {
        xs: 'xs',
        sm: 'sm',
        md: 'md',
        lg: 'lg',
        xl: 'xl',
        xxl: 'xl'
      };
      
      props.size = sizes[breakpoint] || defaultSizes[breakpoint] || 'md';
    }
    
    return props;
  }

  /**
   * Utility to create responsive Mantine component configurations
   * 
   * @param {string} componentType - Type of Mantine component
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} config - Component configuration
   * @returns {Object} Component-specific responsive props
   */
  static createComponentProps(componentType, breakpoint, config = {}) {
    switch (componentType.toLowerCase()) {
      case 'modal':
        return this.createModalProps(breakpoint, config);
      
      case 'select':
      case 'autocomplete':
        return this.createSelectProps(breakpoint, config);
      
      case 'table':
        return this.createTableProps(breakpoint, config);
      
      case 'container':
        return this.createContainerProps(breakpoint, config);
      
      default:
        return {};
    }
  }

  /**
   * Debug utility to log responsive transformations
   * 
   * @param {string} componentName - Name of component being transformed
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} originalConfig - Original configuration
   * @param {Object} transformedProps - Transformed props
   */
  static debug(componentName, breakpoint, originalConfig, transformedProps) {
    if (process.env.NODE_ENV === 'development') {
      // Debug information available through browser dev tools
      // Use: MantineResponsiveAdapter.debug('ComponentName', 'xs', config, props)
      return {
        componentName,
        breakpoint,
        originalConfig,
        transformedProps
      };
    }
  }
}

export default MantineResponsiveAdapter;