import React from 'react';
import { env } from '../config/env';
import { withResponsive, withResponsiveTransform, withResponsiveRender } from '../hoc/withResponsive';
import { withResponsiveProps, withResponsiveEnhancements } from '../hoc/withResponsiveProps';
import MantineResponsiveAdapter from '../adapters/MantineResponsiveAdapter';

/**
 * ResponsiveComponentFactory
 * Factory for creating responsive components with various enhancement patterns
 * 
 * Provides standardized methods for creating responsive components while
 * maintaining consistency and reducing boilerplate code.
 */
export class ResponsiveComponentFactory {
  /**
   * Creates a basic responsive component with prop transformation
   * 
   * @param {React.Component} Component - Base component
   * @param {Object} config - Responsive configuration
   * @returns {React.Component} Enhanced responsive component
   * 
   * @example
   * const ResponsiveButton = ResponsiveComponentFactory.create(Button, {
   *   size: { xs: 'sm', md: 'md', lg: 'lg' },
   *   fullWidth: { xs: true, md: false }
   * });
   */
  static create(Component, config = {}) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.create: Component is required');
    }

    return withResponsiveProps(Component, config);
  }

  /**
   * Creates a Mantine-optimized responsive component
   * Automatically handles Mantine-specific prop transformations
   * 
   * @param {React.Component} MantineComponent - Mantine component
   * @param {Object} config - Responsive configuration
   * @returns {React.Component} Mantine-optimized responsive component
   * 
   * @example
   * const ResponsiveGrid = ResponsiveComponentFactory.createMantine(Grid, {
   *   columns: { xs: 1, sm: 2, md: 3, lg: 4 },
   *   spacing: { xs: 'xs', sm: 'sm', md: 'md' }
   * });
   */
  static createMantine(MantineComponent, config = {}) {
    if (!MantineComponent) {
      throw new Error('ResponsiveComponentFactory.createMantine: MantineComponent is required');
    }

    // Convert config to Mantine-compatible format
    const mantineConfig = MantineResponsiveAdapter.transformConfig(config);
    
    return withResponsiveProps(MantineComponent, mantineConfig);
  }

  /**
   * Creates a responsive component with advanced transformation logic
   * 
   * @param {React.Component} Component - Base component
   * @param {Function} transformer - Transformation function
   * @returns {React.Component} Enhanced responsive component
   * 
   * @example
   * const ResponsiveModal = ResponsiveComponentFactory.createAdvanced(Modal, 
   *   (props, responsive) => ({
   *     ...props,
   *     size: responsive.isMobile ? 'full' : props.size || 'md',
   *     centered: !responsive.isMobile,
   *     fullScreen: responsive.isMobile
   *   })
   * );
   */
  static createAdvanced(Component, transformer) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.createAdvanced: Component is required');
    }

    if (typeof transformer !== 'function') {
      throw new Error('ResponsiveComponentFactory.createAdvanced: transformer must be a function');
    }

    return withResponsiveTransform(Component, transformer);
  }

  /**
   * Creates a conditionally rendered responsive component
   * 
   * @param {React.Component} Component - Base component
   * @param {Object} conditions - Render conditions
   * @returns {React.Component} Conditionally rendered component
   * 
   * @example
   * const DesktopOnlyChart = ResponsiveComponentFactory.createConditional(
   *   ComplexChart, 
   *   { showOn: ['lg', 'xl'] }
   * );
   */
  static createConditional(Component, conditions = {}) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.createConditional: Component is required');
    }

    return withResponsiveRender(Component, conditions);
  }

  /**
   * Creates a comprehensive responsive component with multiple enhancements
   * 
   * @param {React.Component} Component - Base component
   * @param {Object} config - Comprehensive configuration
   * @returns {React.Component} Fully enhanced responsive component
   * 
   * @example
   * const ResponsiveCard = ResponsiveComponentFactory.createComprehensive(Card, {
   *   props: {
   *     shadow: { xs: 'xs', md: 'sm' },
   *     padding: { xs: 'xs', md: 'md' }
   *   },
   *   styles: {
   *     xs: { margin: '8px 0' },
   *     md: { margin: '16px 0' }
   *   },
   *   conditions: {
   *     hideOn: ['xs']
   *   }
   * });
   */
  static createComprehensive(Component, config = {}) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.createComprehensive: Component is required');
    }

    const { props, styles, classes, conditions } = config;
    let EnhancedComponent = Component;

    // Apply responsive enhancements
    if (props || styles || classes) {
      EnhancedComponent = withResponsiveEnhancements(EnhancedComponent, {
        props,
        styles, 
        classes
      });
    }

    // Apply conditional rendering
    if (conditions) {
      EnhancedComponent = withResponsiveRender(EnhancedComponent, conditions);
    }

    return EnhancedComponent;
  }

  /**
   * Creates responsive layout components optimized for grid systems
   * 
   * @param {React.Component} Component - Base layout component
   * @param {Object} layoutConfig - Layout configuration
   * @returns {React.Component} Responsive layout component
   * 
   * @example
   * const ResponsiveContainer = ResponsiveComponentFactory.createLayout(Container, {
   *   size: { xs: 'xs', sm: 'sm', md: 'md', lg: 'lg', xl: 'xl' },
   *   padding: { xs: 'xs', md: 'md' }
   * });
   */
  static createLayout(Component, layoutConfig = {}) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.createLayout: Component is required');
    }

    // Apply layout-specific transformations
    const layoutTransformer = (props, responsive) => {
      const { breakpoint, isMobile, isTablet, isDesktop } = responsive;
      
      // Get configured values for current breakpoint
      const enhancedProps = { ...props };
      
      Object.entries(layoutConfig).forEach(([prop, breakpointValues]) => {
        if (typeof breakpointValues === 'object' && breakpointValues[breakpoint] !== undefined) {
          enhancedProps[prop] = breakpointValues[breakpoint];
        }
      });

      return enhancedProps;
    };

    return withResponsiveTransform(Component, layoutTransformer);
  }

  /**
   * Creates responsive form components with form-specific optimizations
   * 
   * @param {React.Component} FormComponent - Base form component
   * @param {Object} formConfig - Form configuration
   * @returns {React.Component} Responsive form component
   * 
   * @example
   * const ResponsiveTextInput = ResponsiveComponentFactory.createForm(TextInput, {
   *   size: { xs: 'sm', md: 'md' },
   *   radius: { xs: 'xs', md: 'sm' }
   * });
   */
  static createForm(FormComponent, formConfig = {}) {
    if (!FormComponent) {
      throw new Error('ResponsiveComponentFactory.createForm: FormComponent is required');
    }

    // Form-specific responsive transformations
    const formTransformer = (props, responsive) => {
      const { isMobile, isTablet } = responsive;
      
      const enhancedProps = { ...props };
      
      // Apply configured transformations
      Object.entries(formConfig).forEach(([prop, breakpointValues]) => {
        if (typeof breakpointValues === 'object') {
          const value = breakpointValues[responsive.breakpoint];
          if (value !== undefined) {
            enhancedProps[prop] = value;
          }
        }
      });

      // Apply form-specific mobile optimizations
      if (isMobile) {
        enhancedProps.autoComplete = enhancedProps.autoComplete || 'on';
        enhancedProps.spellCheck = enhancedProps.spellCheck !== false;
      }

      return enhancedProps;
    };

    return withResponsiveTransform(FormComponent, formTransformer);
  }

  /**
   * Utility method to create multiple responsive variants of a component
   * 
   * @param {React.Component} Component - Base component
   * @param {Object} variants - Variant configurations
   * @returns {Object} Object with multiple responsive variants
   * 
   * @example
   * const ButtonVariants = ResponsiveComponentFactory.createVariants(Button, {
   *   mobile: { size: { xs: 'sm', sm: 'md' }, fullWidth: { xs: true } },
   *   desktop: { size: { lg: 'lg', xl: 'xl' }, fullWidth: { lg: false } }
   * });
   * 
   * // Usage: <ButtonVariants.mobile>Mobile Button</ButtonVariants.mobile>
   */
  static createVariants(Component, variants = {}) {
    if (!Component) {
      throw new Error('ResponsiveComponentFactory.createVariants: Component is required');
    }

    const variantComponents = {};
    
    Object.entries(variants).forEach(([variantName, config]) => {
      variantComponents[variantName] = this.create(Component, config);
    });

    return variantComponents;
  }

  /**
   * Creates responsive table components with medical data optimizations
   * 
   * @param {React.Component} TableComponent - Base table component (usually ResponsiveTable)
   * @param {Object} tableConfig - Table-specific configuration
   * @returns {React.Component} Medical-optimized responsive table
   * 
   * @example
   * const MedicalTable = ResponsiveComponentFactory.createTable(ResponsiveTable, {
   *   dataType: 'patientList',
   *   priorityColumns: ['name', 'mrn', 'date_of_birth'],
   *   virtualization: 'auto'
   * });
   */
  static createTable(TableComponent, tableConfig = {}) {
    if (!TableComponent) {
      throw new Error('ResponsiveComponentFactory.createTable: TableComponent is required');
    }

    const tableTransformer = (props, responsive) => {
      const { breakpoint, deviceType, isMobile, isTablet, isDesktop } = responsive;
      
      const enhancedProps = { ...props };
      
      // Apply table-specific responsive configurations
      Object.entries(tableConfig).forEach(([prop, value]) => {
        if (typeof value === 'object' && value !== null && value[breakpoint] !== undefined) {
          enhancedProps[prop] = value[breakpoint];
        } else if (typeof value !== 'object') {
          enhancedProps[prop] = value;
        }
      });

      // Medical context optimizations
      if (tableConfig.dataType) {
        enhancedProps.medicalContext = tableConfig.dataType;
      }

      // Mobile-specific optimizations
      if (isMobile) {
        enhancedProps.compactCards = tableConfig.compactOnMobile !== false;
        enhancedProps.showSecondaryInfo = tableConfig.showSecondaryInfo !== false;
      }

      return enhancedProps;
    };

    return withResponsiveTransform(TableComponent, tableTransformer);
  }

  /**
   * Creates responsive modal components with medical form optimizations
   * 
   * @param {React.Component} ModalComponent - Base modal component (usually ResponsiveModal)
   * @param {Object} modalConfig - Modal-specific configuration
   * @returns {React.Component} Medical-optimized responsive modal
   * 
   * @example
   * const MedicalFormModal = ResponsiveComponentFactory.createModal(ResponsiveModal, {
   *   formType: 'patient',
   *   complexity: 'medium',
   *   adaptToContent: true
   * });
   */
  static createModal(ModalComponent, modalConfig = {}) {
    if (!ModalComponent) {
      throw new Error('ResponsiveComponentFactory.createModal: ModalComponent is required');
    }

    const modalTransformer = (props, responsive) => {
      const { breakpoint, deviceType, isMobile, isTablet, isDesktop, width, height } = responsive;
      
      const enhancedProps = { ...props };
      
      // Apply modal-specific responsive configurations
      Object.entries(modalConfig).forEach(([prop, value]) => {
        if (typeof value === 'object' && value !== null && value[breakpoint] !== undefined) {
          enhancedProps[prop] = value[breakpoint];
        } else if (typeof value !== 'object') {
          enhancedProps[prop] = value;
        }
      });

      // Medical form context
      if (modalConfig.formType) {
        enhancedProps.formType = modalConfig.formType;
        enhancedProps.isForm = true;
      }

      if (modalConfig.medicalContext) {
        enhancedProps.medicalContext = modalConfig.medicalContext;
      }

      // Force full screen on very small devices or complex forms
      if (width < 480 || (modalConfig.complexity === 'high' && isMobile)) {
        enhancedProps.forceFullScreen = true;
      }

      return enhancedProps;
    };

    return withResponsiveTransform(ModalComponent, modalTransformer);
  }

  /**
   * Utility method for debugging responsive components
   * Adds debugging information to responsive components
   * 
   * @param {React.Component} ResponsiveComponent - Responsive component to debug
   * @param {string} debugName - Debug identifier
   * @returns {React.Component} Component with debug information
   * 
   * @example
   * const DebugResponsiveButton = ResponsiveComponentFactory.debug(
   *   ResponsiveButton, 
   *   'MyResponsiveButton'
   * );
   */
  static debug(ResponsiveComponent, debugName = 'ResponsiveComponent') {
    return withResponsiveTransform(ResponsiveComponent, (props, responsive) => {
      if (env.DEV) {
        // Debug information available through React Dev Tools
        props.__responsiveDebug = {
          debugName,
          breakpoint: responsive.breakpoint,
          dimensions: { width: responsive.width, height: responsive.height },
          flags: {
            isMobile: responsive.isMobile,
            isTablet: responsive.isTablet,
            isDesktop: responsive.isDesktop
          }
        };
      }

      return props;
    });
  }
}

export default ResponsiveComponentFactory;