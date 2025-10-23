import React, { forwardRef, memo, useMemo } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { useBreakpointValue } from '../hooks/useBreakpoint';

/**
 * Higher-Order Component (HOC) that enhances components with responsive capabilities
 * 
 * Features:
 * - Injects responsive state as props
 * - Transforms props based on breakpoint
 * - Maintains component ref forwarding
 * - Optimized with memoization
 * - Supports custom responsive configurations
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Object} config - Responsive configuration
 * @param {Object} config.props - Props to modify based on breakpoint
 * @param {Object} config.styles - Styles to apply based on breakpoint
 * @param {boolean} config.injectResponsive - Whether to inject responsive object as prop
 * @param {string} config.displayName - Custom display name for debugging
 * @returns {React.Component} Enhanced component with responsive capabilities
 * 
 * @example
 * // Basic usage
 * const ResponsiveCard = withResponsive(Card);
 * 
 * // With configuration
 * const ResponsiveButton = withResponsive(Button, {
 *   props: {
 *     size: { xs: 'sm', md: 'md', lg: 'lg' },
 *     fullWidth: { xs: true, md: false }
 *   },
 *   injectResponsive: true
 * });
 */
export function withResponsive(WrappedComponent, config = {}) {
  const {
    props: responsiveProps = {},
    styles: responsiveStyles = {},
    injectResponsive = false,
    displayName
  } = config;

  const ResponsiveComponent = memo(forwardRef((props, ref) => {
    const responsive = useResponsive();
    const { breakpoint } = responsive;

    // Transform props based on breakpoint
    const transformedProps = useMemo(() => {
      const enhanced = { ...props };

      // Apply responsive prop transformations
      Object.entries(responsiveProps).forEach(([propName, breakpointValues]) => {
        if (typeof breakpointValues === 'object' && breakpointValues !== null) {
          // Get value for current breakpoint with fallback
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
            enhanced[propName] = value;
          }
        }
      });

      // Apply responsive styles
      if (Object.keys(responsiveStyles).length > 0) {
        const currentBreakpoint = responsive.breakpoint;
        let currentStyles = responsiveStyles[currentBreakpoint];
        
        // Fallback to smaller breakpoints if current not defined
        if (!currentStyles) {
          const fallbackOrder = ['xl', 'lg', 'md', 'sm', 'xs'];
          const currentIndex = fallbackOrder.indexOf(currentBreakpoint);
          
          for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
            const fallbackBreakpoint = fallbackOrder[i];
            if (responsiveStyles[fallbackBreakpoint]) {
              currentStyles = responsiveStyles[fallbackBreakpoint];
              break;
            }
          }
        }
        
        currentStyles = currentStyles || {};
        enhanced.style = {
          ...enhanced.style,
          ...currentStyles
        };
      }

      // Inject responsive object if requested
      if (injectResponsive) {
        enhanced.responsive = responsive;
      }

      return enhanced;
    }, [props, responsive, breakpoint]);

    return <WrappedComponent {...transformedProps} ref={ref} />;
  }));

  // Set display name for better debugging
  const componentName = displayName || 
    WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsiveComponent.displayName = `withResponsive(${componentName})`;

  return ResponsiveComponent;
}

/**
 * Enhanced HOC that provides more granular control over responsive behavior
 * 
 * @param {React.Component} WrappedComponent - Component to enhance
 * @param {Function|Object} transformer - Function or object for transforming props
 * @returns {React.Component} Enhanced component
 * 
 * @example
 * // With transformer function
 * const ResponsiveModal = withResponsiveTransform(Modal, (props, responsive) => ({
 *   ...props,
 *   size: responsive.isMobile ? 'full' : props.size,
 *   centered: !responsive.isMobile,
 *   fullScreen: responsive.isMobile
 * }));
 * 
 * // With object transformer
 * const ResponsiveGrid = withResponsiveTransform(Grid, {
 *   cols: { xs: 1, sm: 2, md: 3, lg: 4 },
 *   spacing: { xs: 'xs', sm: 'sm', md: 'md' }
 * });
 */
export function withResponsiveTransform(WrappedComponent, transformer) {
  if (typeof transformer === 'object') {
    // Use object transformer (similar to withResponsive)
    return withResponsive(WrappedComponent, { props: transformer });
  }

  if (typeof transformer !== 'function') {
    throw new Error('withResponsiveTransform: transformer must be a function or object');
  }

  const ResponsiveComponent = memo(forwardRef((props, ref) => {
    const responsive = useResponsive();
    
    const transformedProps = useMemo(() => {
      return transformer(props, responsive);
    }, [props, responsive]);

    return <WrappedComponent {...transformedProps} ref={ref} />;
  }));

  const componentName = WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsiveComponent.displayName = `withResponsiveTransform(${componentName})`;

  return ResponsiveComponent;
}

/**
 * Conditional rendering HOC based on breakpoint
 * 
 * @param {React.Component} WrappedComponent - Component to render conditionally
 * @param {Object} conditions - Breakpoint conditions
 * @returns {React.Component} Component that renders conditionally
 * 
 * @example
 * // Only render on desktop
 * const DesktopOnly = withResponsiveRender(Sidebar, {
 *   showOn: ['lg', 'xl']
 * });
 * 
 * // Hide on mobile
 * const NoMobile = withResponsiveRender(ComplexChart, {
 *   hideOn: ['xs', 'sm']
 * });
 */
export function withResponsiveRender(WrappedComponent, conditions = {}) {
  const { showOn = [], hideOn = [] } = conditions;

  const ResponsiveComponent = memo(forwardRef((props, ref) => {
    const { breakpoint } = useResponsive();

    // Check if component should be hidden
    if (hideOn.includes(breakpoint)) {
      return null;
    }

    // Check if component should only show on specific breakpoints
    if (showOn.length > 0 && !showOn.includes(breakpoint)) {
      return null;
    }

    return <WrappedComponent {...props} ref={ref} />;
  }));

  const componentName = WrappedComponent.displayName || 
    WrappedComponent.name || 
    'Component';
  ResponsiveComponent.displayName = `withResponsiveRender(${componentName})`;

  return ResponsiveComponent;
}

/**
 * HOC for lazy loading components based on breakpoint
 * Useful for loading different components for mobile vs desktop
 * 
 * @param {Object} componentMap - Map of breakpoints to components
 * @param {React.Component} fallback - Fallback component while loading
 * @returns {React.Component} Component that loads different components per breakpoint
 * 
 * @example
 * const ResponsiveNavigation = withResponsiveLazy({
 *   xs: React.lazy(() => import('./MobileNavigation')),
 *   sm: React.lazy(() => import('./MobileNavigation')),
 *   md: React.lazy(() => import('./TabletNavigation')),
 *   lg: React.lazy(() => import('./DesktopNavigation')),
 *   xl: React.lazy(() => import('./DesktopNavigation'))
 * });
 */
export function withResponsiveLazy(componentMap, fallback = null) {
  return memo(forwardRef((props, ref) => {
    const { breakpoint } = useResponsive();
    
    const Component = componentMap[breakpoint] || componentMap.default;
    
    if (!Component) {
      // No component found for breakpoint, return fallback
      return fallback;
    }

    return <Component {...props} ref={ref} />;
  }));
}

export default withResponsive;