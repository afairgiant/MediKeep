/**
 * LayoutStrategy - Base class for responsive layout strategies
 * 
 * Provides a consistent interface for different layout calculation strategies.
 * Each strategy can define how components should behave at different breakpoints.
 * 
 * This follows the Strategy pattern to allow different layout behaviors
 * for different component types (grids, forms, tables, etc.)
 */
export class LayoutStrategy {
  /**
   * Constructor
   * @param {Object} config - Strategy configuration
   */
  constructor(config = {}) {
    this.config = {
      name: 'BaseLayoutStrategy',
      priority: 0,
      ...config
    };
  }

  /**
   * Get number of columns for the given breakpoint
   * Abstract method - must be implemented by subclasses
   * 
   * @param {string} breakpoint - Current breakpoint (xs, sm, md, lg, xl, xxl)
   * @param {Object} context - Additional context (itemCount, containerWidth, etc.)
   * @returns {number} Number of columns
   */
  getColumns(breakpoint, context = {}) {
    throw new Error('LayoutStrategy.getColumns() must be implemented by subclass');
  }

  /**
   * Get spacing/gutter size for the given breakpoint
   * Abstract method - must be implemented by subclasses
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {string|number} Spacing value
   */
  getSpacing(breakpoint, context = {}) {
    throw new Error('LayoutStrategy.getSpacing() must be implemented by subclass');
  }

  /**
   * Get container configuration for the given breakpoint
   * Abstract method - must be implemented by subclasses
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Container configuration
   */
  getContainer(breakpoint, context = {}) {
    throw new Error('LayoutStrategy.getContainer() must be implemented by subclass');
  }

  /**
   * Get complete layout configuration for the given breakpoint
   * Combines all layout aspects into a single configuration object
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Complete layout configuration
   */
  getLayoutConfig(breakpoint, context = {}) {
    return {
      columns: this.getColumns(breakpoint, context),
      spacing: this.getSpacing(breakpoint, context),
      container: this.getContainer(breakpoint, context),
      breakpoint,
      strategy: this.config.name
    };
  }

  /**
   * Validate breakpoint value
   * 
   * @param {string} breakpoint - Breakpoint to validate
   * @returns {boolean} True if valid breakpoint
   */
  isValidBreakpoint(breakpoint) {
    const validBreakpoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
    return validBreakpoints.includes(breakpoint);
  }

  /**
   * Get strategy metadata
   * 
   * @returns {Object} Strategy information
   */
  getInfo() {
    return {
      name: this.config.name,
      priority: this.config.priority,
      type: this.constructor.name
    };
  }

  /**
   * Check if this strategy should be used for the given context
   * Can be overridden by subclasses to provide conditional usage
   * 
   * @param {Object} context - Context to check
   * @returns {boolean} True if strategy should be used
   */
  shouldUse(context = {}) {
    return true;
  }

  /**
   * Calculate responsive properties based on breakpoint
   * Utility method for common responsive calculations
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} breakpointMap - Map of breakpoint to values
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Value for current breakpoint
   */
  getResponsiveValue(breakpoint, breakpointMap = {}, defaultValue = null) {
    if (breakpointMap[breakpoint] !== undefined) {
      return breakpointMap[breakpoint];
    }

    // Fall back to smaller breakpoints if current not defined
    const fallbackOrder = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = fallbackOrder.indexOf(breakpoint);
    
    for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
      const fallbackBreakpoint = fallbackOrder[i];
      if (breakpointMap[fallbackBreakpoint] !== undefined) {
        return breakpointMap[fallbackBreakpoint];
      }
    }

    return defaultValue;
  }

  /**
   * Apply strategy transformations to component props
   * 
   * @param {Object} props - Original component props
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Transformed props
   */
  transformProps(props, breakpoint, context = {}) {
    const layoutConfig = this.getLayoutConfig(breakpoint, context);
    
    return {
      ...props,
      layoutConfig,
      responsive: {
        breakpoint,
        ...layoutConfig
      }
    };
  }

  /**
   * Debug utility to log strategy decisions
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Context used for calculation
   * @param {Object} result - Calculated result
   */
  debug(breakpoint, context, result) {
    if (process.env.NODE_ENV === 'development') {
      console.group(`[${this.config.name}] Layout calculation`);
      console.log('Breakpoint:', breakpoint);
      console.log('Context:', context);
      console.log('Result:', result);
      console.groupEnd();
    }
  }
}

/**
 * Registry for managing multiple layout strategies
 */
export class LayoutStrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.defaultStrategy = null;
  }

  /**
   * Register a layout strategy
   * 
   * @param {string} name - Strategy name
   * @param {LayoutStrategy} strategy - Strategy instance
   * @param {boolean} isDefault - Whether this is the default strategy
   */
  register(name, strategy, isDefault = false) {
    if (!(strategy instanceof LayoutStrategy)) {
      throw new Error('Strategy must be an instance of LayoutStrategy');
    }

    this.strategies.set(name, strategy);
    
    if (isDefault || this.defaultStrategy === null) {
      this.defaultStrategy = strategy;
    }
  }

  /**
   * Get a registered strategy
   * 
   * @param {string} name - Strategy name
   * @returns {LayoutStrategy} Strategy instance
   */
  get(name) {
    return this.strategies.get(name) || this.defaultStrategy;
  }

  /**
   * Get strategy for specific context
   * 
   * @param {Object} context - Context to match against
   * @returns {LayoutStrategy} Best matching strategy
   */
  getForContext(context = {}) {
    // Find strategies that should be used for this context
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.shouldUse(context))
      .sort((a, b) => b.config.priority - a.config.priority); // Higher priority first

    return applicableStrategies[0] || this.defaultStrategy;
  }

  /**
   * List all registered strategies
   * 
   * @returns {Array} Array of strategy information
   */
  list() {
    return Array.from(this.strategies.entries()).map(([name, strategy]) => ({
      name,
      ...strategy.getInfo()
    }));
  }

  /**
   * Remove a strategy from registry
   * 
   * @param {string} name - Strategy name to remove
   */
  unregister(name) {
    const strategy = this.strategies.get(name);
    this.strategies.delete(name);
    
    // If we removed the default strategy, set a new default
    if (strategy === this.defaultStrategy) {
      this.defaultStrategy = this.strategies.size > 0 
        ? this.strategies.values().next().value 
        : null;
    }
  }

  /**
   * Clear all strategies
   */
  clear() {
    this.strategies.clear();
    this.defaultStrategy = null;
  }
}

// Create a global registry instance
export const globalLayoutRegistry = new LayoutStrategyRegistry();

export default LayoutStrategy;