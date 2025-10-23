import React, { forwardRef, memo, useMemo } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { useBreakpointValue, useBreakpointConfig } from '../hooks/useBreakpoint';

/**
 * HOC that transforms component props based on responsive breakpoints
 * More focused than withResponsive, specifically for prop transformation
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Object|Function} propsConfig - Configuration for prop transformation
 * @returns {React.Component} Enhanced component with transformed props
 * 
 * @example
 * // Object configuration
 * const ResponsiveButton = withResponsiveProps(Button, {
 *   size: { xs: 'sm', md: 'lg' },
 *   fullWidth: { xs: true, md: false },
 *   variant: { xs: 'filled', lg: 'outline' }
 * });
 * 
 * // Function configuration
 * const ResponsiveModal = withResponsiveProps(Modal, (responsive) => ({
 *   size: responsive.isMobile ? 'full' : 'lg',
 *   centered: !responsive.isMobile,
 *   fullScreen: responsive.isMobile
 * }));
 */
export function withResponsiveProps(WrappedComponent, propsConfig) {
  if (!propsConfig) {
    throw new Error('withResponsiveProps: propsConfig is required');
  }

  const ResponsivePropsComponent = memo(forwardRef((props, ref) => {
    const responsive = useResponsive();
    
    // Pre-calculate responsive values for object configuration
    const responsiveValues = useMemo(() => {
      if (typeof propsConfig === 'object') {
        const values = {};
        Object.entries(propsConfig).forEach(([propName, breakpointValues]) => {
          // Get responsive value directly from breakpoint
          const currentBreakpoint = responsive.breakpoint;
          let value = breakpointValues[currentBreakpoint];
          
          // Fallback to smaller breakpoints if current not defined
          if (value === undefined) {
            const fallbackOrder = ['xl', 'lg', 'md', 'sm', 'xs'];
            const currentIndex = fallbackOrder.indexOf(currentBreakpoint);
            
            for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
              const fallbackBreakpoint = fallbackOrder[i];
              if (breakpointValues[fallbackBreakpoint] !== undefined) {
                value = breakpointValues[fallbackBreakpoint];
                break;
              }
            }
          }
          
          if (value !== null && value !== undefined) {
            values[propName] = value;
          }
        });
        return values;
      }
      return {};
    }, [responsive.breakpoint]);
    
    const transformedProps = useMemo(() => {
      let responsivePropsToApply = {};

      if (typeof propsConfig === 'function') {
        // Function configuration - call with responsive state
        responsivePropsToApply = propsConfig(responsive) || {};
      } else if (typeof propsConfig === 'object') {
        // Object configuration - use pre-calculated values
        responsivePropsToApply = responsiveValues;
      }

      // Merge original props with responsive props (responsive props take precedence)
      return {
        ...props,
        ...responsivePropsToApply
      };
    }, [props, responsive, responsiveValues]);

    return <WrappedComponent {...transformedProps} ref={ref} />;
  }));

  const componentName = WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsivePropsComponent.displayName = `withResponsiveProps(${componentName})`;

  return ResponsivePropsComponent;
}

/**
 * Creates a hook for responsive props transformation
 * Useful when you need responsive props but don't want to wrap the component
 * 
 * @param {Object|Function} propsConfig - Configuration for prop transformation
 * @returns {Function} Hook that returns responsive props
 * 
 * @example
 * const useResponsiveButtonProps = createResponsivePropsHook({
 *   size: { xs: 'sm', md: 'lg' },
 *   fullWidth: { xs: true, md: false }
 * });
 * 
 * function MyButton(props) {
 *   const responsiveProps = useResponsiveButtonProps();
 *   return <Button {...props} {...responsiveProps} />;
 * }
 */
export function createResponsivePropsHook(propsConfig) {
  if (!propsConfig) {
    throw new Error('createResponsivePropsHook: propsConfig is required');
  }

  return function useResponsiveProps() {
    const responsive = useResponsive();
    
    return useMemo(() => {
      if (typeof propsConfig === 'function') {
        return propsConfig(responsive) || {};
      }

      if (typeof propsConfig === 'object') {
        const responsiveProps = {};
        Object.entries(propsConfig).forEach(([propName, breakpointValues]) => {
          // Get responsive value directly from breakpoint
          const currentBreakpoint = responsive.breakpoint;
          let value = breakpointValues[currentBreakpoint];
          
          // Fallback to smaller breakpoints if current not defined
          if (value === undefined) {
            const fallbackOrder = ['xl', 'lg', 'md', 'sm', 'xs'];
            const currentIndex = fallbackOrder.indexOf(currentBreakpoint);
            
            for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
              const fallbackBreakpoint = fallbackOrder[i];
              if (breakpointValues[fallbackBreakpoint] !== undefined) {
                value = breakpointValues[fallbackBreakpoint];
                break;
              }
            }
          }
          
          if (value !== null && value !== undefined) {
            responsiveProps[propName] = value;
          }
        });
        return responsiveProps;
      }

      return {};
    }, [responsive]);
  };
}

/**
 * HOC for responsive style transformation
 * Applies different styles based on breakpoint
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Object|Function} stylesConfig - Styles configuration
 * @returns {React.Component} Enhanced component with responsive styles
 * 
 * @example
 * const ResponsiveCard = withResponsiveStyles(Card, {
 *   xs: { padding: '8px', fontSize: '14px' },
 *   md: { padding: '16px', fontSize: '16px' },
 *   lg: { padding: '24px', fontSize: '18px' }
 * });
 */
export function withResponsiveStyles(WrappedComponent, stylesConfig) {
  if (!stylesConfig) {
    throw new Error('withResponsiveStyles: stylesConfig is required');
  }

  const ResponsiveStylesComponent = memo(forwardRef((props, ref) => {
    const responsive = useResponsive();
    
    const enhancedProps = useMemo(() => {
      let responsiveStyles = {};

      if (typeof stylesConfig === 'function') {
        responsiveStyles = stylesConfig(responsive) || {};
      } else if (typeof stylesConfig === 'object') {
        // Get responsive styles directly from breakpoint
        const currentBreakpoint = responsive.breakpoint;
        responsiveStyles = stylesConfig[currentBreakpoint];
        
        // Fallback to smaller breakpoints if current not defined
        if (!responsiveStyles) {
          const fallbackOrder = ['xl', 'lg', 'md', 'sm', 'xs'];
          const currentIndex = fallbackOrder.indexOf(currentBreakpoint);
          
          for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
            const fallbackBreakpoint = fallbackOrder[i];
            if (stylesConfig[fallbackBreakpoint]) {
              responsiveStyles = stylesConfig[fallbackBreakpoint];
              break;
            }
          }
        }
        
        responsiveStyles = responsiveStyles || {};
      }

      return {
        ...props,
        style: {
          ...responsiveStyles,
          ...props.style
        }
      };
    }, [props, responsive]);

    return <WrappedComponent {...enhancedProps} ref={ref} />;
  }));

  const componentName = WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsiveStylesComponent.displayName = `withResponsiveStyles(${componentName})`;

  return ResponsiveStylesComponent;
}

/**
 * HOC for responsive className application
 * Applies different CSS classes based on breakpoint
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Object|Function} classConfig - Class configuration
 * @returns {React.Component} Enhanced component with responsive classes
 * 
 * @example
 * const ResponsiveDiv = withResponsiveClasses('div', {
 *   xs: 'mobile-layout',
 *   md: 'tablet-layout', 
 *   lg: 'desktop-layout'
 * });
 */
export function withResponsiveClasses(WrappedComponent, classConfig) {
  if (!classConfig) {
    throw new Error('withResponsiveClasses: classConfig is required');
  }

  const ResponsiveClassesComponent = memo(forwardRef((props, ref) => {
    const responsive = useResponsive();
    
    const enhancedProps = useMemo(() => {
      let responsiveClassName = '';

      if (typeof classConfig === 'function') {
        responsiveClassName = classConfig(responsive) || '';
      } else if (typeof classConfig === 'object') {
        // Get responsive className directly from breakpoint
        const currentBreakpoint = responsive.breakpoint;
        responsiveClassName = classConfig[currentBreakpoint];
        
        // Fallback to smaller breakpoints if current not defined
        if (!responsiveClassName) {
          const fallbackOrder = ['xl', 'lg', 'md', 'sm', 'xs'];
          const currentIndex = fallbackOrder.indexOf(currentBreakpoint);
          
          for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
            const fallbackBreakpoint = fallbackOrder[i];
            if (classConfig[fallbackBreakpoint]) {
              responsiveClassName = classConfig[fallbackBreakpoint];
              break;
            }
          }
        }
        
        responsiveClassName = responsiveClassName || '';
      }

      const combinedClassName = [props.className, responsiveClassName]
        .filter(Boolean)
        .join(' ');

      return {
        ...props,
        className: combinedClassName
      };
    }, [props, responsive]);

    return <WrappedComponent {...enhancedProps} ref={ref} />;
  }));

  const componentName = WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsiveClassesComponent.displayName = `withResponsiveClasses(${componentName})`;

  return ResponsiveClassesComponent;
}

/**
 * Utility function to create responsive prop configurations
 * Helps with creating consistent prop mappings
 * 
 * @param {Object} config - Base configuration
 * @returns {Object} Responsive prop configuration
 * 
 * @example
 * const buttonConfig = createResponsiveConfig({
 *   mobile: { size: 'sm', fullWidth: true },
 *   tablet: { size: 'md', fullWidth: false },
 *   desktop: { size: 'lg', fullWidth: false }
 * });
 * 
 * // Expands to:
 * // {
 * //   size: { xs: 'sm', sm: 'sm', md: 'md', lg: 'lg', xl: 'lg' },
 * //   fullWidth: { xs: true, sm: true, md: false, lg: false, xl: false }
 * // }
 */
export function createResponsiveConfig(config) {
  const { mobile = {}, tablet = {}, desktop = {} } = config;
  
  const result = {};
  const allProps = new Set([
    ...Object.keys(mobile),
    ...Object.keys(tablet), 
    ...Object.keys(desktop)
  ]);

  allProps.forEach(prop => {
    result[prop] = {
      xs: mobile[prop],
      sm: mobile[prop],
      md: tablet[prop] !== undefined ? tablet[prop] : mobile[prop],
      lg: desktop[prop] !== undefined ? desktop[prop] : (tablet[prop] !== undefined ? tablet[prop] : mobile[prop]),
      xl: desktop[prop] !== undefined ? desktop[prop] : (tablet[prop] !== undefined ? tablet[prop] : mobile[prop])
    };
  });

  return result;
}

/**
 * Batch HOC for applying multiple responsive transformations
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Object} config - Configuration object
 * @returns {React.Component} Enhanced component
 * 
 * @example
 * const ResponsiveButton = withResponsiveEnhancements(Button, {
 *   props: {
 *     size: { xs: 'sm', lg: 'lg' },
 *     fullWidth: { xs: true, lg: false }
 *   },
 *   styles: {
 *     xs: { margin: '4px' },
 *     lg: { margin: '8px' }
 *   },
 *   classes: {
 *     xs: 'mobile-button',
 *     lg: 'desktop-button'
 *   }
 * });
 */
export function withResponsiveEnhancements(WrappedComponent, config = {}) {
  const { props: propsConfig, styles: stylesConfig, classes: classConfig } = config;
  
  let EnhancedComponent = WrappedComponent;

  if (propsConfig) {
    EnhancedComponent = withResponsiveProps(EnhancedComponent, propsConfig);
  }

  if (stylesConfig) {
    EnhancedComponent = withResponsiveStyles(EnhancedComponent, stylesConfig);
  }

  if (classConfig) {
    EnhancedComponent = withResponsiveClasses(EnhancedComponent, classConfig);
  }

  return EnhancedComponent;
}

export default withResponsiveProps;