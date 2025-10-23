import React, { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Modal as MantineModal, 
  ScrollArea, 
  Box,
  rem
} from '@mantine/core';
import { useResponsive } from '../../hooks/useResponsive';
import { MedicalFormLayoutStrategy } from '../../strategies/MedicalFormLayoutStrategy';
import logger from '../../services/logger';

/**
 * ResponsiveModal Component
 * 
 * Enhanced Mantine Modal component with responsive behavior optimized for medical forms.
 * Uses MedicalFormLayoutStrategy for intelligent modal sizing and layout based on screen size and form complexity.
 * 
 * Features:
 * - Mobile: Full screen modals with optimized touch targets
 * - Tablet: Large (lg) modals with appropriate spacing
 * - Desktop: Extra large (xl) modals with comprehensive layout
 * - Responsive sizing based on viewport and form complexity
 * - Integration with MedicalFormLayoutStrategy for form modals
 * - Proper scroll behavior and focus management
 * - Accessibility: Focus trapping, ARIA labels, keyboard navigation
 * - Performance: Optimized rendering and portal management
 */
export const ResponsiveModal = memo(({
  // Core modal props
  opened = false,
  onClose,
  title,
  children,
  
  // Modal configuration
  size,
  fullScreen,
  centered = true,
  overlayProps,
  transitionProps,
  
  // Medical form integration
  formType = 'standard',
  medicalContext = 'general',
  complexity = 'medium',
  fieldCount,
  isForm = false,
  
  // Responsive behavior
  responsiveSize = 'auto',
  forceFullScreen = false,
  adaptToContent = true,
  
  // Scroll behavior
  scrollAreaComponent: ScrollAreaComponent = ScrollArea,
  withScrollArea = 'auto',
  maxHeight,
  
  // Styling
  className = '',
  padding,
  radius,
  shadow = 'md',
  
  // Content props
  withCloseButton = true,
  closeButtonProps,
  trapFocus = true,
  returnFocus = true,
  
  // Portal and z-index
  portalProps,
  zIndex,
  target,
  
  // Callbacks
  onOpen,
  
  // Accessibility
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  
  ...props
}) => {
  const { breakpoint, deviceType, isMobile, isTablet, isDesktop, width, height } = useResponsive();
  const strategyRef = useRef(new MedicalFormLayoutStrategy());
  const modalRef = useRef(null);
  const hasOpenedRef = useRef(false);

  // Component logging context
  const componentContext = useMemo(() => ({
    component: 'ResponsiveModal',
    breakpoint,
    deviceType,
    formType,
    medicalContext,
    complexity,
    fieldCount: fieldCount || 0,
    isForm,
    opened
  }), [breakpoint, deviceType, formType, medicalContext, complexity, fieldCount, isForm, opened]);

  // Log modal state changes
  useEffect(() => {
    if (opened && !hasOpenedRef.current) {
      logger.info('ResponsiveModal opened', componentContext);
      hasOpenedRef.current = true;
      
      if (onOpen) {
        onOpen();
      }
    } else if (!opened && hasOpenedRef.current) {
      logger.info('ResponsiveModal closed', componentContext);
      hasOpenedRef.current = false;
    }
  }, [opened, componentContext, onOpen]);

  useEffect(() => {
    logger.debug('ResponsiveModal breakpoint changed', {
      ...componentContext,
      previousBreakpoint: breakpoint
    });
  }, [breakpoint]);

  // Medical form layout strategy context
  const strategyContext = useMemo(() => ({
    formType,
    fieldCount: fieldCount || 0,
    complexity,
    isModal: true,
    fullScreen: forceFullScreen || fullScreen,
    medical: true,
    healthcare: true
  }), [formType, fieldCount, complexity, forceFullScreen, fullScreen]);

  // Get responsive modal configuration
  const modalConfig = useMemo(() => {
    const strategy = strategyRef.current;
    
    const config = {
      // Modal size based on strategy or override
      size: size || (responsiveSize === 'auto' ? 
        strategy.getModalSize(breakpoint, strategyContext) : responsiveSize),
      
      // Container configuration
      container: strategy.getContainer(breakpoint, strategyContext),
      
      // Spacing and padding
      spacing: strategy.getSpacing(breakpoint, strategyContext),
      
      // Accessibility configuration  
      accessibility: strategy.getAccessibilityConfig(breakpoint, strategyContext)
    };

    // Force full screen on mobile if form is complex or explicitly requested
    if ((isMobile && (complexity === 'high' || fieldCount > 10)) || forceFullScreen) {
      config.size = 'full';
      config.fullScreen = true;
    } else {
      config.fullScreen = fullScreen || false;
    }

    // Adjust for very small screens
    if (width < 480 && !config.fullScreen) {
      config.size = 'full';
      config.fullScreen = true;
    }

    logger.debug('Modal configuration calculated', {
      ...componentContext,
      calculatedSize: config.size,
      fullScreen: config.fullScreen,
      containerSize: config.container.size
    });

    return config;
  }, [size, responsiveSize, breakpoint, strategyContext, isMobile, complexity, fieldCount, 
      forceFullScreen, fullScreen, width, componentContext]);

  // Handle modal close with logging
  const handleClose = useCallback(() => {
    logger.info('ResponsiveModal close requested', componentContext);
    
    if (onClose) {
      onClose();
    }
  }, [onClose, componentContext]);

  // Determine if scroll area should be used
  const shouldUseScrollArea = useMemo(() => {
    if (withScrollArea === true) return true;
    if (withScrollArea === false) return false;
    
    // Auto mode: use scroll area for non-full-screen modals on larger screens
    return !modalConfig.fullScreen && (isTablet || isDesktop);
  }, [withScrollArea, modalConfig.fullScreen, isTablet, isDesktop]);

  // Calculate responsive padding
  const responsivePadding = useMemo(() => {
    if (padding !== undefined) return padding;
    
    // Get padding from strategy
    const strategyPadding = modalConfig.container.padding;
    
    // Convert strategy padding to appropriate values
    const paddingMap = {
      xs: rem(8),
      sm: rem(12), 
      md: rem(16),
      lg: rem(24),
      xl: rem(32)
    };

    return paddingMap[strategyPadding] || paddingMap.md;
  }, [padding, modalConfig.container.padding]);

  // Calculate responsive max height
  const responsiveMaxHeight = useMemo(() => {
    if (maxHeight) return maxHeight;
    if (modalConfig.fullScreen) return '100vh';
    
    // Use viewport height with some breathing room
    const viewportHeight = height || (typeof window !== 'undefined' ? window.innerHeight : 800);
    const maxHeightValue = Math.min(viewportHeight * 0.9, 800);
    
    return rem(maxHeightValue);
  }, [maxHeight, modalConfig.fullScreen, height]);

  // Responsive transition props
  const responsiveTransitionProps = useMemo(() => {
    if (transitionProps) return transitionProps;
    
    const baseTransition = {
      duration: isMobile ? 200 : 150,
      timingFunction: 'ease-out'
    };

    if (modalConfig.fullScreen) {
      return {
        ...baseTransition,
        transition: 'slide-up'
      };
    }

    return {
      ...baseTransition,
      transition: 'fade'
    };
  }, [transitionProps, isMobile, modalConfig.fullScreen]);

  // Responsive overlay props
  const responsiveOverlayProps = useMemo(() => {
    const baseOverlay = {
      opacity: 0.55,
      blur: 0.5
    };

    // Stronger overlay on mobile for better focus
    if (isMobile) {
      baseOverlay.opacity = 0.7;
    }

    return {
      ...baseOverlay,
      ...overlayProps
    };
  }, [overlayProps, isMobile]);

  // Enhanced accessibility props
  const accessibilityProps = useMemo(() => {
    const baseAccessibility = {
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      trapFocus,
      returnFocus
    };

    // Enhanced accessibility for medical forms
    if (isForm && modalConfig.accessibility) {
      baseAccessibility.trapFocus = modalConfig.accessibility.focusTrapping;
      
      if (formType === 'emergency') {
        // Emergency forms should have stronger focus management
        baseAccessibility.returnFocus = true;
        baseAccessibility.trapFocus = true;
      }
    }

    return baseAccessibility;
  }, [ariaLabelledBy, ariaDescribedBy, trapFocus, returnFocus, isForm, 
      modalConfig.accessibility, formType]);

  // Responsive close button props
  const responsiveCloseButtonProps = useMemo(() => {
    const baseCloseButton = {
      size: isMobile ? 'lg' : 'md',
      'aria-label': 'Close modal'
    };

    // Larger close button for touch interfaces
    if (isMobile || deviceType === 'tablet') {
      baseCloseButton.size = 'lg';
    }

    return {
      ...baseCloseButton,
      ...closeButtonProps
    };
  }, [isMobile, deviceType, closeButtonProps]);

  // Wrap content with scroll area if needed
  const wrappedChildren = useMemo(() => {
    if (!shouldUseScrollArea) {
      return children;
    }

    return (
      <ScrollAreaComponent
        h={responsiveMaxHeight}
        scrollbarSize={isMobile ? 0 : 8}
        scrollHideDelay={500}
        type={isMobile ? 'never' : 'auto'}
        styles={(theme) => ({
          scrollbar: {
            '&:hover': {
              backgroundColor: isMobile ? 'transparent' : theme.colors.gray[2]
            }
          }
        })}
      >
        {children}
      </ScrollAreaComponent>
    );
  }, [shouldUseScrollArea, children, ScrollAreaComponent, responsiveMaxHeight, isMobile]);

  // Error handling for invalid props
  if (typeof opened !== 'boolean') {
    logger.error('ResponsiveModal received invalid opened prop', {
      ...componentContext,
      openedType: typeof opened,
      opened
    });
    return null;
  }

  return (
    <MantineModal
      ref={modalRef}
      
      // Core props
      opened={opened}
      onClose={handleClose}
      title={title}
      size={modalConfig.size}
      fullScreen={modalConfig.fullScreen}
      centered={centered}
      
      // Responsive styling
      padding={responsivePadding}
      radius={modalConfig.fullScreen ? 0 : radius}
      shadow={modalConfig.fullScreen ? 'none' : shadow}
      
      // Behavior props
      withCloseButton={withCloseButton}
      closeButtonProps={responsiveCloseButtonProps}
      overlayProps={responsiveOverlayProps}
      transitionProps={responsiveTransitionProps}
      
      // Portal and z-index
      portalProps={portalProps}
      zIndex={zIndex}
      target={target}
      
      // Accessibility
      {...accessibilityProps}
      
      // Styling
      className={className}
      
      // Mobile-specific styles
      styles={(theme) => ({
        inner: {
          paddingLeft: isMobile ? 0 : theme.spacing.md,
          paddingRight: isMobile ? 0 : theme.spacing.md,
          paddingTop: isMobile ? 0 : theme.spacing.md,
          paddingBottom: isMobile ? 0 : theme.spacing.md
        },
        content: {
          maxHeight: shouldUseScrollArea ? undefined : responsiveMaxHeight,
          overflow: shouldUseScrollArea ? 'visible' : 'auto'
        },
        header: {
          position: modalConfig.fullScreen ? 'sticky' : 'relative',
          top: modalConfig.fullScreen ? 0 : undefined,
          zIndex: modalConfig.fullScreen ? 1000 : undefined,
          backgroundColor: modalConfig.fullScreen ? theme.colors.white : undefined,
          borderBottom: modalConfig.fullScreen ? `${rem(1)} solid ${theme.colors.gray[2]}` : 'none'
        },
        title: {
          fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.xl,
          fontWeight: formType === 'emergency' ? 700 : 600
        }
      })}
      
      // Additional props
      {...props}
    >
      <Box
        // Medical form specific container props
        {...(isForm && {
          'data-medical-form': true,
          'data-form-type': formType,
          'data-complexity': complexity
        })}
      >
        {wrappedChildren}
      </Box>
    </MantineModal>
  );
});

ResponsiveModal.displayName = 'ResponsiveModal';

export default ResponsiveModal;