import LayoutStrategy from './LayoutStrategy';
import { RESPONSIVE_VALUES } from '../config/responsive.config';
import logger from '../services/logger';

/**
 * MedicalFormLayoutStrategy
 * Concrete implementation of LayoutStrategy specifically designed for medical forms
 * 
 * Provides responsive layout calculations optimized for:
 * - Medical data entry forms
 * - Patient information forms 
 * - Healthcare provider forms
 * - Clinical documentation forms
 * - Modal-based medical forms
 * 
 * Features:
 * - Smart field grouping based on screen size
 * - Accessibility-first design patterns
 * - Medical form-specific spacing and layout
 * - Modal sizing optimization
 * - Progressive disclosure for complex forms
 */
export class MedicalFormLayoutStrategy extends LayoutStrategy {
  constructor(config = {}) {
    super({
      name: 'MedicalFormLayoutStrategy',
      priority: 2, // Higher priority than GridLayoutStrategy for medical forms
      ...config
    });

    // Medical form specific configuration
    this.formConfig = {
      // Field grouping strategies
      groupingStrategy: 'contextual', // 'contextual' | 'sequential' | 'priority'
      
      // Column strategies per breakpoint for form fields
      fieldColumns: {
        xs: 1,  // Mobile: single column
        sm: 1,  // Large mobile: single column  
        md: 2,  // Tablet: two columns
        lg: 3,  // Desktop: three columns
        xl: 3,  // Large desktop: three columns
        xxl: 4  // Extra large: four columns max
      },

      // Modal sizing per breakpoint
      modalSizes: {
        xs: 'full',    // Full screen on mobile
        sm: 'full',    // Full screen on large mobile
        md: 'lg',      // Large modal on tablet
        lg: 'xl',      // Extra large modal on desktop
        xl: 'xl',      // Extra large modal on large desktop
        xxl: 'xl'      // Extra large modal on extra large screens
      },

      // Field priority grouping for responsive layouts
      fieldPriorities: {
        critical: ['name', 'email', 'phone', 'date_of_birth', 'medical_record_number'],
        important: ['address', 'emergency_contact', 'insurance', 'allergies'],
        standard: ['notes', 'preferences', 'additional_info'],
        optional: ['secondary_contact', 'billing_notes', 'internal_notes']
      },

      // Accessibility considerations
      accessibility: {
        minTouchTarget: 44,      // Minimum touch target size in pixels
        labelPositioning: 'top', // 'top' | 'left' | 'floating'
        focusIndicators: true,
        screenReaderOptimized: true,
        highContrastSupport: true
      },

      // Form layout patterns
      layoutPatterns: {
        singleSection: 'stack',     // Stack all fields vertically
        multiSection: 'tabbed',     // Use tabs for sections on larger screens
        wizard: 'stepped',          // Step-by-step progression
        inline: 'horizontal'        // Horizontal layout for short forms
      },

      ...config.form
    };

    // Medical context patterns for intelligent field grouping
    this.contextPatterns = {
      personalInfo: ['first_name', 'last_name', 'middle_name', 'date_of_birth', 'gender', 'ssn'],
      contactInfo: ['email', 'phone', 'address', 'city', 'state', 'zip_code'],
      medicalInfo: ['allergies', 'medications', 'conditions', 'procedures'],
      emergencyInfo: ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'],
      insuranceInfo: ['insurance_provider', 'policy_number', 'group_number'],
      clinicalData: ['symptoms', 'diagnosis', 'treatment', 'notes', 'follow_up'],
      timestamps: ['created_date', 'updated_date', 'start_date', 'end_date']
    };
  }

  /**
   * Get optimal number of columns for medical form fields
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context including field count, form type, etc.
   * @returns {number} Number of columns for form layout
   */
  getColumns(breakpoint, context = {}) {
    const { 
      fieldCount = 0,
      formType = 'standard',
      complexity = 'medium',
      sectionCount = 1,
      priorityFields = [],
      forceColumns = null
    } = context;

    // Override with explicit column specification
    if (forceColumns !== null && forceColumns > 0) {
      return Math.min(forceColumns, this.getMaxColumns(breakpoint));
    }

    // Get base columns from configuration
    const baseColumns = this.getResponsiveValue(
      breakpoint,
      this.formConfig.fieldColumns,
      this.getDefaultFormColumns(breakpoint)
    );

    // Adjust based on form complexity and field count
    let adjustedColumns = baseColumns;

    // Simple forms with few fields should use fewer columns
    if (fieldCount <= 4) {
      adjustedColumns = Math.min(adjustedColumns, 2);
    } else if (fieldCount <= 8) {
      adjustedColumns = Math.min(adjustedColumns, breakpoint === 'xs' || breakpoint === 'sm' ? 1 : 2);
    }

    // Complex medical forms may need more structured layouts
    if (complexity === 'high' && sectionCount > 2) {
      // Use more columns on larger screens for better organization
      if (breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === 'xxl') {
        adjustedColumns = Math.min(adjustedColumns + 1, this.getMaxColumns(breakpoint));
      }
    }

    // Form type specific adjustments
    switch (formType) {
      case 'patient':
        // Patient forms benefit from 2-3 columns on larger screens
        adjustedColumns = this.adjustColumnsForPatientForm(breakpoint, adjustedColumns, fieldCount);
        break;
      
      case 'clinical':
        // Clinical forms need more space, prefer fewer columns
        adjustedColumns = Math.min(adjustedColumns, breakpoint === 'xs' || breakpoint === 'sm' ? 1 : 2);
        break;
      
      case 'emergency':
        // Emergency forms prioritize speed and clarity
        adjustedColumns = breakpoint === 'xs' || breakpoint === 'sm' ? 1 : 2;
        break;
      
      case 'wizard':
        // Wizard forms are typically single column for focus
        adjustedColumns = 1;
        break;
    }

    // Ensure we don't exceed maximum columns for the breakpoint
    return Math.min(adjustedColumns, this.getMaxColumns(breakpoint));
  }

  /**
   * Adjust columns specifically for patient forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {number} baseColumns - Base column count
   * @param {number} fieldCount - Number of fields
   * @returns {number} Adjusted column count
   */
  adjustColumnsForPatientForm(breakpoint, baseColumns, fieldCount) {
    // Patient forms have predictable patterns
    if (breakpoint === 'xs' || breakpoint === 'sm') {
      return 1; // Always single column on mobile
    }
    
    if (fieldCount >= 12) {
      // Larger patient forms benefit from 3 columns on desktop
      return Math.min(baseColumns + 1, 3);
    }
    
    return baseColumns;
  }

  /**
   * Get default form columns for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Default column count
   */
  getDefaultFormColumns(breakpoint) {
    const defaults = {
      xs: 1,
      sm: 1, 
      md: 2,
      lg: 3,
      xl: 3,
      xxl: 4
    };

    return defaults[breakpoint] || 2;
  }

  /**
   * Get maximum allowed columns for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Maximum column count
   */
  getMaxColumns(breakpoint) {
    const maxColumns = {
      xs: 1,
      sm: 2,
      md: 3,
      lg: 4,
      xl: 4,
      xxl: 5
    };

    return maxColumns[breakpoint] || 3;
  }

  /**
   * Get spacing configuration for medical forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {string} Spacing value for Mantine components
   */
  getSpacing(breakpoint, context = {}) {
    const { 
      density = 'comfortable',
      formType = 'standard',
      accessibility = true
    } = context;

    // Accessibility requires larger spacing
    if (accessibility && this.formConfig.accessibility.minTouchTarget >= 44) {
      return this.getAccessibleSpacing(breakpoint);
    }

    // Dense layouts for power users or limited screen space
    if (density === 'compact') {
      return this.getCompactSpacing(breakpoint);
    }

    // Emergency forms need larger touch targets
    if (formType === 'emergency') {
      return this.getEmergencySpacing(breakpoint);
    }

    // Default comfortable spacing for medical forms
    return this.getComfortableSpacing(breakpoint);
  }

  /**
   * Get accessible spacing that meets touch target requirements
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Mantine spacing value
   */
  getAccessibleSpacing(breakpoint) {
    const accessibleSpacing = {
      xs: 'md',  // 16px - ensures 44px touch targets with padding
      sm: 'md',  // 16px
      md: 'lg',  // 24px - more comfortable on tablets
      lg: 'lg',  // 24px
      xl: 'xl',  // 32px - generous spacing on large screens
      xxl: 'xl'  // 32px
    };

    return accessibleSpacing[breakpoint] || 'lg';
  }

  /**
   * Get compact spacing for dense layouts
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Mantine spacing value
   */
  getCompactSpacing(breakpoint) {
    const compactSpacing = {
      xs: 'xs',  // 8px
      sm: 'sm',  // 12px
      md: 'sm',  // 12px
      lg: 'md',  // 16px
      xl: 'md',  // 16px
      xxl: 'lg'  // 24px
    };

    return compactSpacing[breakpoint] || 'sm';
  }

  /**
   * Get spacing optimized for emergency forms (larger touch targets)
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Mantine spacing value
   */
  getEmergencySpacing(breakpoint) {
    const emergencySpacing = {
      xs: 'lg',   // 24px - large touch targets critical on mobile
      sm: 'lg',   // 24px
      md: 'xl',   // 32px - even larger on tablets
      lg: 'xl',   // 32px
      xl: 'xl',   // 32px
      xxl: 'xl'   // 32px
    };

    return emergencySpacing[breakpoint] || 'lg';
  }

  /**
   * Get comfortable default spacing for medical forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Mantine spacing value
   */
  getComfortableSpacing(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      {
        xs: 'sm',   // 12px
        sm: 'md',   // 16px  
        md: 'md',   // 16px
        lg: 'lg',   // 24px
        xl: 'lg',   // 24px
        xxl: 'xl'   // 32px
      },
      'md'
    );
  }

  /**
   * Get container configuration for medical forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {Object} Container configuration
   */
  getContainer(breakpoint, context = {}) {
    const { 
      formType = 'standard',
      isModal = true,
      fullScreen = false
    } = context;

    const config = {
      // Medical forms are typically centered and contained
      fluid: fullScreen,
      centered: !fullScreen,
      padding: this.getContainerPadding(breakpoint, context),
      maxWidth: this.getContainerMaxWidth(breakpoint, context),
      size: isModal ? this.getModalSize(breakpoint, context) : this.getPageSize(breakpoint)
    };

    return config;
  }

  /**
   * Get maximum width for form container
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {string|number} Maximum width value
   */
  getContainerMaxWidth(breakpoint, context = {}) {
    const { 
      formType = 'standard',
      complexity = 'medium',
      isModal = true 
    } = context;

    // Modal forms use different sizing
    if (isModal) {
      return '100%'; // Modal handles its own max-width
    }

    // Page forms use responsive container widths
    const containerWidths = {
      xs: '100%',
      sm: '100%', 
      md: '768px',
      lg: '1024px',
      xl: '1200px',
      xxl: '1400px'
    };

    // Emergency forms should be wider for better visibility
    if (formType === 'emergency') {
      return containerWidths[breakpoint] || '100%';
    }

    // Complex forms need more space
    if (complexity === 'high') {
      const wideWidths = {
        xs: '100%',
        sm: '100%',
        md: '900px', 
        lg: '1200px',
        xl: '1400px',
        xxl: '1600px'
      };
      return wideWidths[breakpoint] || containerWidths[breakpoint] || '100%';
    }

    return containerWidths[breakpoint] || '100%';
  }

  /**
   * Get modal size based on breakpoint and form complexity
   * 
   * @param {string} breakpoint - Current breakpoint  
   * @param {Object} context - Form context
   * @returns {string} Mantine modal size
   */
  getModalSize(breakpoint, context = {}) {
    const { 
      fieldCount = 0,
      complexity = 'medium',
      formType = 'standard'
    } = context;

    // Base modal size from configuration
    let modalSize = this.getResponsiveValue(
      breakpoint,
      this.formConfig.modalSizes,
      this.getDefaultModalSize(breakpoint)
    );

    // Adjust based on form complexity and field count
    if (fieldCount > 15 || complexity === 'high') {
      // Large forms need bigger modals on desktop
      if (breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === 'xxl') {
        modalSize = 'xl';
      }
    }

    // Emergency forms should be prominent
    if (formType === 'emergency') {
      modalSize = breakpoint === 'xs' || breakpoint === 'sm' ? 'full' : 'xl';
    }

    return modalSize;
  }

  /**
   * Get default modal size for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Default modal size
   */
  getDefaultModalSize(breakpoint) {
    const defaults = {
      xs: 'full',
      sm: 'full',
      md: 'lg',
      lg: 'xl', 
      xl: 'xl',
      xxl: 'xl'
    };

    return defaults[breakpoint] || 'lg';
  }

  /**
   * Get page container size for non-modal forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Container size
   */
  getPageSize(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      RESPONSIVE_VALUES.containerWidth,
      this.getDefaultPageSize(breakpoint)
    );
  }

  /**
   * Get default page container size
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Default container size
   */
  getDefaultPageSize(breakpoint) {
    const sizes = {
      xs: 'xs',
      sm: 'sm', 
      md: 'md',
      lg: 'lg',
      xl: 'lg', // Don't make forms too wide on very large screens
      xxl: 'xl'
    };

    return sizes[breakpoint] || 'md';
  }

  /**
   * Get container padding based on breakpoint and context
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {string} Mantine padding value
   */
  getContainerPadding(breakpoint, context = {}) {
    const { isModal = true, density = 'comfortable' } = context;

    if (isModal) {
      // Modal forms have internal padding handled by Modal component
      return this.getModalPadding(breakpoint, density);
    } else {
      // Page forms need their own padding
      return this.getPagePadding(breakpoint, density);
    }
  }

  /**
   * Get modal internal padding
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {string} density - Layout density
   * @returns {string} Padding value
   */
  getModalPadding(breakpoint, density) {
    const basePadding = {
      xs: 'sm',   // 12px - minimal padding on mobile
      sm: 'md',   // 16px 
      md: 'md',   // 16px
      lg: 'lg',   // 24px - more comfortable on larger screens
      xl: 'lg',   // 24px
      xxl: 'xl'   // 32px
    };

    const padding = basePadding[breakpoint] || 'md';

    // Adjust for density
    if (density === 'compact') {
      const compactMap = { xs: 'xs', sm: 'sm', md: 'sm', lg: 'md', xl: 'md', xxl: 'lg' };
      return compactMap[padding] || 'sm';
    }

    return padding;
  }

  /**
   * Get page container padding
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {string} density - Layout density
   * @returns {string} Padding value
   */
  getPagePadding(breakpoint, density) {
    const basePadding = {
      xs: 'md',   // 16px - need more padding than modals
      sm: 'lg',   // 24px
      md: 'lg',   // 24px
      lg: 'xl',   // 32px
      xl: 'xl',   // 32px
      xxl: 'xl'   // 32px - don't go too large
    };

    const padding = basePadding[breakpoint] || 'lg';

    if (density === 'compact') {
      const compactMap = { sm: 'xs', md: 'sm', lg: 'md', xl: 'md', xl: 'lg' };
      return compactMap[padding] || 'md';
    }

    return padding;
  }

  /**
   * Generate field grouping strategy based on context and screen size
   * 
   * @param {Array} fields - Array of field configurations
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {Object} Field grouping configuration
   */
  getFieldGrouping(fields, breakpoint, context = {}) {
    const { groupingStrategy = this.formConfig.groupingStrategy } = context;
    const columns = this.getColumns(breakpoint, context);

    switch (groupingStrategy) {
      case 'contextual':
        return this.getContextualGrouping(fields, columns, breakpoint);
      
      case 'priority':
        return this.getPriorityGrouping(fields, columns, breakpoint);
      
      case 'sequential':
        return this.getSequentialGrouping(fields, columns);
      
      default:
        return this.getContextualGrouping(fields, columns, breakpoint);
    }
  }

  /**
   * Group fields by medical context (personal info, medical info, etc.)
   * 
   * @param {Array} fields - Field configurations
   * @param {number} columns - Number of columns
   * @param {string} breakpoint - Current breakpoint
   * @returns {Object} Contextual grouping
   */
  getContextualGrouping(fields, columns, breakpoint) {
    const groups = {};
    const ungrouped = [];

    // Categorize fields by context
    fields.forEach(field => {
      let grouped = false;
      
      for (const [contextName, contextFields] of Object.entries(this.contextPatterns)) {
        if (contextFields.includes(field.name)) {
          if (!groups[contextName]) {
            groups[contextName] = [];
          }
          groups[contextName].push(field);
          grouped = true;
          break;
        }
      }
      
      if (!grouped) {
        ungrouped.push(field);
      }
    });

    // Add ungrouped fields to a general section
    if (ungrouped.length > 0) {
      groups.additional = ungrouped;
    }

    // Calculate rows per group based on columns
    const groupedRows = {};
    Object.entries(groups).forEach(([groupName, groupFields]) => {
      groupedRows[groupName] = this.calculateRowsFromFields(groupFields, columns);
    });

    return {
      strategy: 'contextual',
      columns,
      groups: groupedRows,
      order: this.getContextualOrder(breakpoint)
    };
  }

  /**
   * Get the optimal order for contextual groups based on breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {Array} Ordered group names
   */
  getContextualOrder(breakpoint) {
    // Mobile-first ordering prioritizes most important information
    const mobileOrder = [
      'personalInfo',
      'contactInfo', 
      'emergencyInfo',
      'medicalInfo',
      'insuranceInfo',
      'clinicalData',
      'additional',
      'timestamps'
    ];

    // Desktop can show more context-driven ordering
    const desktopOrder = [
      'personalInfo',
      'contactInfo',
      'medicalInfo',
      'clinicalData', 
      'emergencyInfo',
      'insuranceInfo',
      'additional',
      'timestamps'
    ];

    return (breakpoint === 'xs' || breakpoint === 'sm') ? mobileOrder : desktopOrder;
  }

  /**
   * Group fields by priority for progressive disclosure
   * 
   * @param {Array} fields - Field configurations
   * @param {number} columns - Number of columns
   * @param {string} breakpoint - Current breakpoint
   * @returns {Object} Priority-based grouping
   */
  getPriorityGrouping(fields, columns, breakpoint) {
    const priorityGroups = {};
    
    // Initialize priority groups
    Object.keys(this.formConfig.fieldPriorities).forEach(priority => {
      priorityGroups[priority] = [];
    });
    priorityGroups.unassigned = [];

    // Categorize fields by priority
    fields.forEach(field => {
      let assigned = false;
      
      for (const [priorityLevel, priorityFields] of Object.entries(this.formConfig.fieldPriorities)) {
        if (priorityFields.includes(field.name)) {
          priorityGroups[priorityLevel].push(field);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        priorityGroups.unassigned.push(field);
      }
    });

    // Convert to rows
    const groupedRows = {};
    Object.entries(priorityGroups).forEach(([priority, priorityFields]) => {
      if (priorityFields.length > 0) {
        groupedRows[priority] = this.calculateRowsFromFields(priorityFields, columns);
      }
    });

    return {
      strategy: 'priority',
      columns,
      groups: groupedRows,
      order: ['critical', 'important', 'standard', 'optional', 'unassigned']
    };
  }

  /**
   * Group fields sequentially into rows
   * 
   * @param {Array} fields - Field configurations
   * @param {number} columns - Number of columns
   * @returns {Object} Sequential grouping
   */
  getSequentialGrouping(fields, columns) {
    return {
      strategy: 'sequential',
      columns,
      rows: this.calculateRowsFromFields(fields, columns),
      order: ['main']
    };
  }

  /**
   * Calculate field rows based on column span and available columns
   * 
   * @param {Array} fields - Field configurations
   * @param {number} columns - Available columns
   * @returns {Array} Array of field rows
   */
  calculateRowsFromFields(fields, columns) {
    const rows = [];
    let currentRow = [];
    let currentRowSpan = 0;

    fields.forEach(field => {
      const fieldSpan = this.getFieldSpan(field, columns);
      
      // Start new row if current field won't fit
      if (currentRowSpan + fieldSpan > columns) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [{ ...field, span: fieldSpan }];
        currentRowSpan = fieldSpan;
      } else {
        currentRow.push({ ...field, span: fieldSpan });
        currentRowSpan += fieldSpan;
      }
    });

    // Add final row
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Determine appropriate span for a field based on its type and available columns
   * 
   * @param {Object} field - Field configuration
   * @param {number} totalColumns - Total available columns
   * @returns {number} Column span for the field
   */
  getFieldSpan(field, totalColumns) {
    // Explicit span override
    if (field.gridColumn !== undefined) {
      return Math.min(field.gridColumn, totalColumns);
    }

    // Field type based spanning
    const { type, name } = field;
    
    // Full-width fields
    if (type === 'textarea' || type === 'divider' || 
        name.includes('notes') || name.includes('description') ||
        name.includes('address')) {
      return totalColumns;
    }

    // Wide fields that benefit from more space
    if (type === 'email' || type === 'url' || 
        name.includes('name') && !name.includes('first') && !name.includes('last')) {
      return Math.min(Math.ceil(totalColumns * 0.6), totalColumns);
    }

    // Compact fields
    if (type === 'number' || type === 'date' || type === 'rating' || 
        name.includes('zip') || name.includes('age') || name.includes('code')) {
      return Math.min(Math.ceil(totalColumns / 3), Math.max(1, totalColumns - 1));
    }

    // Default span based on total columns
    if (totalColumns === 1) return 1;
    if (totalColumns === 2) return 1;
    if (totalColumns >= 3) return Math.ceil(totalColumns / 3);
    
    return 1;
  }

  /**
   * Get accessibility configuration for medical forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {Object} Accessibility configuration
   */
  getAccessibilityConfig(breakpoint, context = {}) {
    const { highContrast = false, largeText = false } = context;

    return {
      // WCAG 2.1 AA compliance settings
      minTouchTarget: this.formConfig.accessibility.minTouchTarget,
      colorContrast: highContrast ? 'AAA' : 'AA',
      fontSize: largeText ? 'large' : 'normal',
      
      // Screen reader optimizations
      labelStrategy: this.formConfig.accessibility.labelPositioning,
      ariaDescriptions: this.formConfig.accessibility.screenReaderOptimized,
      
      // Keyboard navigation
      tabOrder: 'logical',
      skipLinks: true,
      
      // Focus management
      focusIndicators: this.formConfig.accessibility.focusIndicators,
      focusTrapping: true,
      
      // Responsive accessibility
      responsiveLabels: this.getResponsiveLabelStrategy(breakpoint),
      responsiveSpacing: this.getAccessibleSpacing(breakpoint)
    };
  }

  /**
   * Get responsive label positioning strategy
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Label positioning strategy
   */
  getResponsiveLabelStrategy(breakpoint) {
    // Mobile: always top labels for better readability
    if (breakpoint === 'xs' || breakpoint === 'sm') {
      return 'top';
    }
    
    // Tablet and desktop: can use left labels for compact forms
    return this.formConfig.accessibility.labelPositioning;
  }

  /**
   * Check if this strategy should be used for the given context
   * 
   * @param {Object} context - Context to check
   * @returns {boolean} True if strategy should be used
   */
  shouldUse(context = {}) {
    const { 
      formType, 
      componentType, 
      medical = false,
      healthcare = false 
    } = context;

    // Explicitly medical/healthcare contexts
    if (medical || healthcare) {
      return true;
    }

    // Medical form types
    const medicalFormTypes = [
      'patient',
      'medical',
      'clinical', 
      'healthcare',
      'practitioner',
      'allergy',
      'medication',
      'condition',
      'procedure',
      'visit',
      'emergency'
    ];

    if (formType && medicalFormTypes.some(type => formType.toLowerCase().includes(type))) {
      return true;
    }

    // Medical component types
    const medicalComponents = [
      'medicalform',
      'patientform', 
      'clinicalform',
      'healthcareform',
      'practitionerform'
    ];

    if (componentType && medicalComponents.some(type => componentType.toLowerCase().includes(type))) {
      return true;
    }

    return false;
  }

  /**
   * Transform props for medical form components
   * 
   * @param {Object} props - Original props
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Transformed props optimized for medical forms
   */
  transformProps(props, breakpoint, context = {}) {
    const layoutConfig = this.getLayoutConfig(breakpoint, context);
    const fieldGrouping = this.getFieldGrouping(props.fields || [], breakpoint, context);
    const accessibilityConfig = this.getAccessibilityConfig(breakpoint, context);

    return {
      ...props,
      
      // Layout configuration
      layoutConfig,
      
      // Medical form specific props
      medicalForm: {
        grouping: fieldGrouping,
        accessibility: accessibilityConfig,
        modalSize: layoutConfig.container.size,
        spacing: layoutConfig.spacing,
        columns: layoutConfig.columns
      },
      
      // Responsive configuration
      responsive: {
        breakpoint,
        ...layoutConfig,
        medical: true
      }
    };
  }

  /**
   * Debug utility for medical form layout decisions
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Context used for calculation
   * @param {Object} result - Calculated result
   */
  debug(breakpoint, context, result) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('medical_form_layout_calculation', 'Medical form layout calculated', {
        component: 'MedicalFormLayoutStrategy',
        breakpoint,
        context: {
          formType: context.formType,
          fieldCount: context.fieldCount,
          complexity: context.complexity
        },
        result: {
          columns: result.columns,
          spacing: result.spacing,
          modalSize: result.container?.size,
          accessibility: result.accessibility || 'default'
        }
      });
    }
  }

  /**
   * Get responsive value from configuration object
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} valuesConfig - Configuration object with breakpoint values
   * @param {*} defaultValue - Default value if no match found
   * @returns {*} Responsive value
   */
  getResponsiveValue(breakpoint, valuesConfig, defaultValue) {
    if (!valuesConfig || typeof valuesConfig !== 'object') {
      return defaultValue;
    }
    
    // Direct breakpoint match
    if (valuesConfig[breakpoint] !== undefined) {
      return valuesConfig[breakpoint];
    }
    
    // Fallback through breakpoint hierarchy
    const hierarchy = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = hierarchy.indexOf(breakpoint);
    
    if (currentIndex >= 0) {
      // Try smaller breakpoints first (mobile-first approach)
      for (let i = hierarchy.length - 1; i >= 0; i--) {
        const bp = hierarchy[i];
        if (valuesConfig[bp] !== undefined && i >= currentIndex) {
          return valuesConfig[bp];
        }
      }
      
      // If no match found, try any available value
      for (const bp of hierarchy) {
        if (valuesConfig[bp] !== undefined) {
          return valuesConfig[bp];
        }
      }
    }
    
    return defaultValue;
  }

  /**
   * Get maximum columns for a breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Maximum columns
   */
  getMaxColumns(breakpoint) {
    const maxCols = {
      xs: 1,
      sm: 2, 
      md: 3,
      lg: 4,
      xl: 4,
      xxl: 5
    };
    
    return maxCols[breakpoint] || 3;
  }

  /**
   * Get container padding for forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Form context
   * @returns {string} Padding value
   */
  getContainerPadding(breakpoint, context = {}) {
    const { density = 'comfortable', isModal = true } = context;
    
    if (isModal) {
      // Modal forms need less padding since modal provides container
      const modalPadding = {
        xs: 'xs',
        sm: 'sm',
        md: 'md', 
        lg: 'lg',
        xl: 'lg',
        xxl: 'lg'
      };
      return modalPadding[breakpoint] || 'md';
    }
    
    // Page forms need more padding
    const pagePadding = {
      xs: 'md',
      sm: 'md',
      md: 'lg',
      lg: 'xl', 
      xl: 'xl',
      xxl: 'xl'
    };
    
    return pagePadding[breakpoint] || 'lg';
  }

  /**
   * Get page size for non-modal forms
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Page size
   */
  getPageSize(breakpoint) {
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
   * Get default form columns for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Default columns
   */
  getDefaultFormColumns(breakpoint) {
    const defaults = {
      xs: 1,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 3,
      xxl: 4
    };
    
    return defaults[breakpoint] || 2;
  }

  /**
   * Get default modal size for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Modal size
   */
  getDefaultModalSize(breakpoint) {
    const defaults = {
      xs: 'full',
      sm: 'full', 
      md: 'lg',
      lg: 'xl',
      xl: 'xl',
      xxl: 'xl'
    };
    
    return defaults[breakpoint] || 'lg';
  }

  /**
   * Get different types of spacing configurations
   */
  getAccessibleSpacing(breakpoint) {
    const spacing = { xs: 'md', sm: 'md', md: 'lg', lg: 'lg', xl: 'xl', xxl: 'xl' };
    return spacing[breakpoint] || 'lg';
  }

  getCompactSpacing(breakpoint) {
    const spacing = { xs: 'xs', sm: 'xs', md: 'sm', lg: 'sm', xl: 'md', xxl: 'md' };
    return spacing[breakpoint] || 'sm';
  }

  getEmergencySpacing(breakpoint) {
    const spacing = { xs: 'lg', sm: 'lg', md: 'xl', lg: 'xl', xl: 'xl', xxl: 'xl' };
    return spacing[breakpoint] || 'xl';
  }

  getComfortableSpacing(breakpoint) {
    const spacing = { xs: 'sm', sm: 'md', md: 'md', lg: 'lg', xl: 'lg', xxl: 'xl' };
    return spacing[breakpoint] || 'md';
  }
}

/**
 * Create a pre-configured medical form strategy for common use cases
 * 
 * @param {Object} config - Strategy configuration
 * @returns {MedicalFormLayoutStrategy} Configured strategy instance
 */
export function createMedicalFormStrategy(config = {}) {
  return new MedicalFormLayoutStrategy(config);
}

/**
 * Pre-defined medical form strategies for common medical contexts
 */
export const MEDICAL_FORM_STRATEGIES = {
  // Standard patient information form
  patient: createMedicalFormStrategy({
    form: {
      groupingStrategy: 'contextual',
      fieldColumns: { xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 3 },
      modalSizes: { xs: 'full', sm: 'full', md: 'lg', lg: 'xl', xl: 'xl', xxl: 'xl' }
    }
  }),

  // Clinical documentation form
  clinical: createMedicalFormStrategy({
    form: {
      groupingStrategy: 'priority',
      fieldColumns: { xs: 1, sm: 1, md: 1, lg: 2, xl: 2, xxl: 2 },
      modalSizes: { xs: 'full', sm: 'full', md: 'xl', lg: 'xl', xl: 'xl', xxl: 'xl' },
      accessibility: { minTouchTarget: 48 }
    }
  }),

  // Emergency/urgent care form
  emergency: createMedicalFormStrategy({
    form: {
      groupingStrategy: 'priority',
      fieldColumns: { xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 },
      modalSizes: { xs: 'full', sm: 'full', md: 'xl', lg: 'xl', xl: 'xl', xxl: 'xl' },
      accessibility: { minTouchTarget: 56, highContrastSupport: true }
    }
  }),

  // Compact/mobile-optimized form
  compact: createMedicalFormStrategy({
    form: {
      groupingStrategy: 'sequential',
      fieldColumns: { xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 },
      modalSizes: { xs: 'md', sm: 'lg', md: 'lg', lg: 'lg', xl: 'xl', xxl: 'xl' }
    }
  }),

  // Comprehensive/detailed medical form
  comprehensive: createMedicalFormStrategy({
    form: {
      groupingStrategy: 'contextual',
      fieldColumns: { xs: 1, sm: 1, md: 2, lg: 3, xl: 4, xxl: 4 },
      modalSizes: { xs: 'full', sm: 'full', md: 'xl', lg: 'xl', xl: 'xl', xxl: 'xl' }
    }
  })
};

export default MedicalFormLayoutStrategy;