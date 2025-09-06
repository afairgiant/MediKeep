import LayoutStrategy from './LayoutStrategy';
import { RESPONSIVE_VALUES, getDeviceType } from '../config/responsive.config';
import logger from '../services/logger';

/**
 * TableLayoutStrategy
 * Concrete implementation of LayoutStrategy specifically designed for medical data tables
 * 
 * Provides responsive layout calculations optimized for:
 * - Patient lists and medical records tables
 * - Lab results and test data
 * - Medication lists and dosage schedules
 * - Immunization records and history
 * - Allergy tables and clinical data
 * - Visit history and appointment schedules
 * - Vital signs monitoring tables
 * 
 * Features:
 * - Column priority system (critical, important, standard, optional)
 * - Responsive table behaviors: full table on desktop, horizontal scroll on tablet, card view on mobile
 * - Row density options optimized for different viewports
 * - Virtual scrolling integration for large medical datasets
 * - Accessibility-compliant table navigation
 * - Medical data type-specific optimizations
 */
export class TableLayoutStrategy extends LayoutStrategy {
  constructor(config = {}) {
    super({
      name: 'TableLayoutStrategy',
      priority: 3, // Higher priority than form strategies for table contexts
      ...config
    });

    // Table-specific configuration
    this.tableConfig = {
      // Column priority definitions for medical tables
      columnPriorities: {
        critical: ['id', 'name', 'patient_name', 'date', 'status', 'urgency'],
        important: ['type', 'provider', 'result', 'value', 'dosage', 'condition'],
        standard: ['description', 'notes', 'location', 'department'],
        optional: ['created_date', 'updated_date', 'reference', 'internal_id']
      },

      // Display strategies per breakpoint
      displayStrategy: {
        xs: 'cards',        // Card layout for mobile
        sm: 'cards',        // Card layout for large mobile
        md: 'horizontal_scroll', // Horizontal scrolling table for tablets
        lg: 'full_table',   // Full table for laptops
        xl: 'full_table',   // Full table for desktops
        xxl: 'full_table'   // Full table for large desktops
      },

      // Row density settings per breakpoint
      rowDensity: {
        xs: 'comfortable',   // Larger touch targets on mobile
        sm: 'comfortable',   // Larger touch targets on large mobile
        md: 'standard',      // Standard spacing on tablets
        lg: 'standard',      // Standard spacing on laptops
        xl: 'compact',       // More data density on desktops
        xxl: 'compact'       // More data density on large screens
      },

      // Virtual scrolling thresholds
      virtualization: {
        enabled: true,
        threshold: {
          xs: 20,    // Mobile: virtualize after 20 rows
          sm: 30,    // Large mobile: 30 rows
          md: 50,    // Tablet: 50 rows
          lg: 100,   // Laptop: 100 rows
          xl: 200,   // Desktop: 200 rows
          xxl: 300   // Large desktop: 300 rows
        },
        itemHeight: {
          compact: 40,
          standard: 48,
          comfortable: 56
        }
      },

      // Card layout configuration for mobile
      cardLayout: {
        columns: {
          xs: 1,     // Single column on mobile
          sm: 1      // Single column on large mobile
        },
        spacing: {
          xs: 'sm',  // 12px spacing
          sm: 'md'   // 16px spacing
        },
        showFields: {
          xs: 3,     // Show max 3 fields per card on mobile
          sm: 4      // Show max 4 fields per card on large mobile
        }
      },

      // Table styling and behavior
      tableFeatures: {
        striped: true,
        highlightOnHover: true,
        sortable: true,
        filterable: true,
        resizable: true,
        stickyHeader: true,
        pagination: {
          xs: 'simple',      // Simple pagination on mobile
          sm: 'simple',      // Simple pagination on large mobile
          md: 'standard',    // Standard pagination on tablet
          lg: 'full',        // Full pagination on desktop
          xl: 'full',        // Full pagination on large desktop
          xxl: 'full'        // Full pagination on extra large desktop
        }
      },

      // Accessibility settings
      accessibility: {
        keyboardNavigation: true,
        screenReaderOptimized: true,
        highContrastSupport: true,
        focusIndicators: true,
        ariaLabels: true,
        tableRole: true,
        sortAnnouncements: true
      },

      // Medical data type specific configurations
      medicalDataTypes: {
        patientList: {
          displayName: 'Patient Records',
          criticalColumns: ['patient_name', 'mrn', 'date_of_birth', 'status'],
          searchableFields: ['name', 'mrn', 'phone', 'email'],
          defaultSort: { field: 'patient_name', direction: 'asc' }
        },
        
        medications: {
          displayName: 'Medications',
          criticalColumns: ['medication_name', 'dosage', 'frequency', 'status'],
          searchableFields: ['medication_name', 'generic_name'],
          defaultSort: { field: 'start_date', direction: 'desc' }
        },
        
        labResults: {
          displayName: 'Lab Results',
          criticalColumns: ['test_name', 'result', 'reference_range', 'date'],
          searchableFields: ['test_name', 'category'],
          defaultSort: { field: 'date', direction: 'desc' }
        },
        
        allergies: {
          displayName: 'Allergies',
          criticalColumns: ['allergen', 'severity', 'reaction', 'date_identified'],
          searchableFields: ['allergen', 'reaction'],
          defaultSort: { field: 'severity', direction: 'desc' }
        },
        
        immunizations: {
          displayName: 'Immunizations',
          criticalColumns: ['vaccine_name', 'date_administered', 'provider', 'next_due'],
          searchableFields: ['vaccine_name', 'manufacturer'],
          defaultSort: { field: 'date_administered', direction: 'desc' }
        },
        
        visits: {
          displayName: 'Visit History',
          criticalColumns: ['visit_date', 'provider', 'visit_type', 'diagnosis'],
          searchableFields: ['provider', 'diagnosis', 'notes'],
          defaultSort: { field: 'visit_date', direction: 'desc' }
        },
        
        vitalSigns: {
          displayName: 'Vital Signs',
          criticalColumns: ['date_time', 'blood_pressure', 'pulse', 'temperature'],
          searchableFields: ['notes'],
          defaultSort: { field: 'date_time', direction: 'desc' }
        }
      },

      ...config.table
    };
  }

  /**
   * Get optimal number of columns for table display
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context including data type, row count, etc.
   * @returns {number} Number of columns to display
   */
  getColumns(breakpoint, context = {}) {
    const { 
      dataType = 'general',
      totalColumns = 0,
      availableColumns = [],
      forceColumns = null,
      displayStrategy = null
    } = context;

    // Override with explicit column specification
    if (forceColumns !== null && forceColumns > 0) {
      return Math.min(forceColumns, totalColumns);
    }

    // Determine display strategy for current breakpoint
    const strategy = displayStrategy || this.getDisplayStrategy(breakpoint, context);

    // Cards don't use column concept in the same way
    if (strategy === 'cards') {
      return this.getCardColumns(breakpoint);
    }

    // Get visible columns based on priority and breakpoint
    const visibleColumns = this.getVisibleColumns(breakpoint, context);
    
    return Math.min(visibleColumns.length, totalColumns);
  }

  /**
   * Determine the display strategy for the current breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {string} Display strategy (cards, horizontal_scroll, full_table)
   */
  getDisplayStrategy(breakpoint, context = {}) {
    const { 
      forceStrategy = null,
      dataType = 'general',
      rowCount = 0
    } = context;

    // Override with explicit strategy
    if (forceStrategy) {
      return forceStrategy;
    }

    // Get base strategy from configuration
    let strategy = this.getResponsiveValue(
      breakpoint,
      this.tableConfig.displayStrategy,
      this.getDefaultDisplayStrategy(breakpoint)
    );

    // Adjust strategy based on data characteristics
    if (rowCount > 100 && (breakpoint === 'xs' || breakpoint === 'sm')) {
      // Large datasets on mobile should always use cards for performance
      strategy = 'cards';
    }

    // Medical data type specific adjustments
    const medicalConfig = this.tableConfig.medicalDataTypes[dataType];
    if (medicalConfig && medicalConfig.criticalColumns.length > 6) {
      // Tables with many critical columns benefit from horizontal scroll on tablets
      if (breakpoint === 'md' && strategy === 'full_table') {
        strategy = 'horizontal_scroll';
      }
    }

    return strategy;
  }

  /**
   * Get default display strategy for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Default display strategy
   */
  getDefaultDisplayStrategy(breakpoint) {
    const deviceType = getDeviceType(breakpoint);
    
    switch (deviceType) {
      case 'mobile':
        return 'cards';
      case 'tablet':
        return 'horizontal_scroll';
      case 'desktop':
      default:
        return 'full_table';
    }
  }

  /**
   * Get number of columns for card layout
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Number of card columns
   */
  getCardColumns(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      this.tableConfig.cardLayout.columns,
      1
    );
  }

  /**
   * Determine which columns should be visible based on priority and breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {Array} Array of visible column identifiers
   */
  getVisibleColumns(breakpoint, context = {}) {
    const { 
      availableColumns = [],
      dataType = 'general',
      customPriorities = null
    } = context;

    // Use custom priorities if provided, otherwise use medical data type or default priorities
    let priorities = customPriorities;
    if (!priorities) {
      const medicalConfig = this.tableConfig.medicalDataTypes[dataType];
      priorities = medicalConfig ? {
        critical: medicalConfig.criticalColumns,
        important: [],
        standard: [],
        optional: []
      } : this.tableConfig.columnPriorities;
    }

    const deviceType = getDeviceType(breakpoint);
    const visibleColumns = [];

    // Always show critical columns
    availableColumns.forEach(column => {
      if (priorities.critical.includes(column.key || column.name || column)) {
        visibleColumns.push(column);
      }
    });

    // Add important columns based on screen size
    if (deviceType !== 'mobile') {
      availableColumns.forEach(column => {
        if (priorities.important.includes(column.key || column.name || column) && 
            !visibleColumns.includes(column)) {
          visibleColumns.push(column);
        }
      });
    }

    // Add standard columns on larger screens
    if (deviceType === 'desktop') {
      availableColumns.forEach(column => {
        if (priorities.standard.includes(column.key || column.name || column) && 
            !visibleColumns.includes(column)) {
          visibleColumns.push(column);
        }
      });
    }

    // Add optional columns only on very large screens
    if (breakpoint === 'xl' || breakpoint === 'xxl') {
      availableColumns.forEach(column => {
        if (priorities.optional.includes(column.key || column.name || column) && 
            !visibleColumns.includes(column)) {
          visibleColumns.push(column);
        }
      });
    }

    // If no columns matched priorities, show first few columns as fallback
    if (visibleColumns.length === 0) {
      const maxColumns = this.getMaxColumnsForBreakpoint(breakpoint);
      return availableColumns.slice(0, maxColumns);
    }

    return visibleColumns;
  }

  /**
   * Get maximum columns that can be displayed comfortably on a breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Maximum column count
   */
  getMaxColumnsForBreakpoint(breakpoint) {
    const maxColumns = {
      xs: 2,     // Very limited on mobile
      sm: 3,     // Slightly more on large mobile
      md: 5,     // Reasonable number for tablets
      lg: 8,     // Good desktop experience
      xl: 12,    // Many columns on large desktops
      xxl: 15    // Maximum for very large screens
    };

    return maxColumns[breakpoint] || 5;
  }

  /**
   * Get spacing configuration for tables
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {string} Spacing value for Mantine components
   */
  getSpacing(breakpoint, context = {}) {
    const { 
      density = null,
      displayStrategy = null
    } = context;

    const strategy = displayStrategy || this.getDisplayStrategy(breakpoint, context);
    const rowDensity = density || this.getRowDensity(breakpoint, context);

    // Card layout uses different spacing
    if (strategy === 'cards') {
      return this.getCardSpacing(breakpoint);
    }

    // Table spacing based on density
    return this.getTableSpacing(breakpoint, rowDensity);
  }

  /**
   * Get row density for the current breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {string} Row density (comfortable, standard, compact)
   */
  getRowDensity(breakpoint, context = {}) {
    const { forceDensity = null } = context;

    if (forceDensity) {
      return forceDensity;
    }

    return this.getResponsiveValue(
      breakpoint,
      this.tableConfig.rowDensity,
      'standard'
    );
  }

  /**
   * Get spacing for card layout
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Mantine spacing value
   */
  getCardSpacing(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      this.tableConfig.cardLayout.spacing,
      'md'
    );
  }

  /**
   * Get spacing for table layout based on density
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {string} density - Row density
   * @returns {string} Mantine spacing value
   */
  getTableSpacing(breakpoint, density) {
    const densitySpacing = {
      comfortable: {
        xs: 'md',   // 16px
        sm: 'lg',   // 24px
        md: 'lg',   // 24px
        lg: 'lg',   // 24px
        xl: 'xl',   // 32px
        xxl: 'xl'   // 32px
      },
      standard: {
        xs: 'sm',   // 12px
        sm: 'md',   // 16px
        md: 'md',   // 16px
        lg: 'md',   // 16px
        xl: 'lg',   // 24px
        xxl: 'lg'   // 24px
      },
      compact: {
        xs: 'xs',   // 8px
        sm: 'sm',   // 12px
        md: 'sm',   // 12px
        lg: 'sm',   // 12px
        xl: 'md',   // 16px
        xxl: 'md'   // 16px
      }
    };

    return densitySpacing[density]?.[breakpoint] || 'md';
  }

  /**
   * Get container configuration for tables
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {Object} Container configuration
   */
  getContainer(breakpoint, context = {}) {
    const { 
      fullWidth = false,
      maxHeight = null,
      displayStrategy = null,
      enableVirtualization = null
    } = context;

    const strategy = displayStrategy || this.getDisplayStrategy(breakpoint, context);
    const useVirtualization = enableVirtualization !== null ? 
      enableVirtualization : this.shouldUseVirtualization(breakpoint, context);

    const config = {
      // Container sizing
      fluid: fullWidth || strategy === 'horizontal_scroll',
      maxWidth: this.getContainerMaxWidth(breakpoint, strategy),
      
      // Scrolling behavior
      scrollable: strategy === 'horizontal_scroll',
      scrollAreaProps: strategy === 'horizontal_scroll' ? {
        type: 'auto',
        scrollbarSize: 8,
        styles: (theme) => ({
          scrollbar: {
            '&:hover': {
              backgroundColor: theme.colors.gray[2]
            }
          }
        })
      } : null,

      // Height management
      maxHeight: maxHeight || this.getTableMaxHeight(breakpoint, strategy),
      
      // Virtualization
      virtualized: useVirtualization,
      virtualizationProps: useVirtualization ? {
        threshold: this.getVirtualizationThreshold(breakpoint),
        itemHeight: this.getVirtualItemHeight(breakpoint, context)
      } : null,

      // Table features
      features: this.getTableFeatures(breakpoint, context),
      
      // Accessibility
      accessibility: this.getTableAccessibility(breakpoint, context)
    };

    return config;
  }

  /**
   * Get container max width based on display strategy
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {string} strategy - Display strategy
   * @returns {string} Max width value
   */
  getContainerMaxWidth(breakpoint, strategy) {
    if (strategy === 'cards' || strategy === 'horizontal_scroll') {
      return '100%';
    }

    // Full table uses standard responsive container widths
    return this.getResponsiveValue(
      breakpoint,
      RESPONSIVE_VALUES.containerWidth,
      '100%'
    );
  }

  /**
   * Get maximum table height to prevent excessive scrolling
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {string} strategy - Display strategy
   * @returns {string} Max height value
   */
  getTableMaxHeight(breakpoint, strategy) {
    // Cards don't need height restrictions
    if (strategy === 'cards') {
      return null;
    }

    const maxHeights = {
      xs: '60vh',   // Mobile: don't take up entire screen
      sm: '65vh',   // Large mobile: slightly more
      md: '70vh',   // Tablet: more vertical space
      lg: '75vh',   // Desktop: generous vertical space
      xl: '80vh',   // Large desktop: even more space
      xxl: '85vh'   // Extra large: maximum space
    };

    return maxHeights[breakpoint] || '70vh';
  }

  /**
   * Determine if virtualization should be used
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {boolean} Whether to use virtualization
   */
  shouldUseVirtualization(breakpoint, context = {}) {
    if (!this.tableConfig.virtualization.enabled) {
      return false;
    }

    const { rowCount = 0 } = context;
    const threshold = this.getVirtualizationThreshold(breakpoint);
    
    return rowCount > threshold;
  }

  /**
   * Get virtualization threshold for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {number} Row count threshold
   */
  getVirtualizationThreshold(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      this.tableConfig.virtualization.threshold,
      50
    );
  }

  /**
   * Get virtual item height based on density
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {number} Item height in pixels
   */
  getVirtualItemHeight(breakpoint, context = {}) {
    const density = this.getRowDensity(breakpoint, context);
    return this.tableConfig.virtualization.itemHeight[density] || 48;
  }

  /**
   * Get table feature configuration
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {Object} Feature configuration
   */
  getTableFeatures(breakpoint, context = {}) {
    const { 
      disableSort = false,
      disableFilter = false,
      disableResize = false
    } = context;

    const deviceType = getDeviceType(breakpoint);
    
    return {
      ...this.tableConfig.tableFeatures,
      sortable: !disableSort && this.tableConfig.tableFeatures.sortable,
      filterable: !disableFilter && this.tableConfig.tableFeatures.filterable,
      resizable: !disableResize && this.tableConfig.tableFeatures.resizable && deviceType === 'desktop',
      pagination: this.getPaginationConfig(breakpoint),
      stickyHeader: deviceType !== 'mobile' && this.tableConfig.tableFeatures.stickyHeader
    };
  }

  /**
   * Get pagination configuration for breakpoint
   * 
   * @param {string} breakpoint - Current breakpoint
   * @returns {string} Pagination type
   */
  getPaginationConfig(breakpoint) {
    return this.getResponsiveValue(
      breakpoint,
      this.tableConfig.tableFeatures.pagination,
      'standard'
    );
  }

  /**
   * Get accessibility configuration for tables
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {Object} Accessibility configuration
   */
  getTableAccessibility(breakpoint, context = {}) {
    const { highContrast = false } = context;

    return {
      ...this.tableConfig.accessibility,
      
      // Enhanced keyboard navigation for larger screens
      enhancedKeyboardNav: getDeviceType(breakpoint) === 'desktop',
      
      // High contrast mode adjustments
      highContrast,
      
      // Screen reader optimizations
      announceRowCount: true,
      announceColumnCount: true,
      announceSort: this.tableConfig.accessibility.sortAnnouncements,
      
      // ARIA labels
      tableLabel: this.getTableAriaLabel(context),
      columnHeaders: this.getColumnAriaLabels(context)
    };
  }

  /**
   * Generate ARIA label for table based on context
   * 
   * @param {Object} context - Table context
   * @returns {string} ARIA label
   */
  getTableAriaLabel(context) {
    const { dataType = 'general', rowCount = 0 } = context;
    
    const medicalConfig = this.tableConfig.medicalDataTypes[dataType];
    const displayName = medicalConfig?.displayName || 'Data Table';
    
    return `${displayName} with ${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`;
  }

  /**
   * Generate ARIA labels for columns
   * 
   * @param {Object} context - Table context
   * @returns {Object} Column ARIA labels
   */
  getColumnAriaLabels(context) {
    const { availableColumns = [], dataType = 'general' } = context;
    
    const medicalConfig = this.tableConfig.medicalDataTypes[dataType];
    const labels = {};
    
    availableColumns.forEach(column => {
      const columnKey = column.key || column.name || column;
      labels[columnKey] = column.ariaLabel || column.label || columnKey;
    });
    
    return labels;
  }

  /**
   * Get field configuration for card layout
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Table context
   * @returns {Object} Card field configuration
   */
  getCardFieldConfig(breakpoint, context = {}) {
    const { dataType = 'general', availableColumns = [] } = context;
    
    const maxFields = this.getResponsiveValue(
      breakpoint,
      this.tableConfig.cardLayout.showFields,
      3
    );

    const visibleColumns = this.getVisibleColumns(breakpoint, context);
    const displayFields = visibleColumns.slice(0, maxFields);
    
    // Add additional fields that are commonly useful in cards
    const medicalConfig = this.tableConfig.medicalDataTypes[dataType];
    if (medicalConfig) {
      const additionalFields = availableColumns.filter(column => {
        const columnKey = column.key || column.name || column;
        return medicalConfig.searchableFields.includes(columnKey) && 
               !displayFields.some(field => (field.key || field.name || field) === columnKey);
      });
      
      // Add one searchable field if we have room
      if (displayFields.length < maxFields && additionalFields.length > 0) {
        displayFields.push(additionalFields[0]);
      }
    }

    return {
      displayFields,
      maxFields,
      showSecondaryInfo: breakpoint !== 'xs',
      compactMode: breakpoint === 'xs'
    };
  }

  /**
   * Check if this strategy should be used for the given context
   * 
   * @param {Object} context - Context to check
   * @returns {boolean} True if strategy should be used
   */
  shouldUse(context = {}) {
    const { 
      componentType, 
      dataType,
      tableType,
      medical = false,
      healthcare = false,
      hasTableData = false
    } = context;

    // Explicitly medical/healthcare table contexts
    if (medical || healthcare) {
      return true;
    }

    // Medical data types
    if (dataType && Object.keys(this.tableConfig.medicalDataTypes).includes(dataType)) {
      return true;
    }

    // Table component types
    const tableComponents = [
      'table',
      'datatable',
      'medicaltable',
      'patientlist',
      'labresults',
      'medications',
      'allergies',
      'immunizations',
      'visits',
      'vitalsigns'
    ];

    if (componentType && tableComponents.some(type => 
      componentType.toLowerCase().includes(type.toLowerCase()))) {
      return true;
    }

    // Table type indicators
    const medicalTableTypes = [
      'patient',
      'medical',
      'clinical',
      'lab',
      'medication',
      'allergy',
      'immunization',
      'visit',
      'vital'
    ];

    if (tableType && medicalTableTypes.some(type => 
      tableType.toLowerCase().includes(type))) {
      return true;
    }

    // Generic table with medical data
    if (hasTableData && (medical || healthcare)) {
      return true;
    }

    return false;
  }

  /**
   * Transform props for table components
   * 
   * @param {Object} props - Original props
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Additional context
   * @returns {Object} Transformed props optimized for medical tables
   */
  transformProps(props, breakpoint, context = {}) {
    const layoutConfig = this.getLayoutConfig(breakpoint, context);
    const displayStrategy = this.getDisplayStrategy(breakpoint, context);
    const visibleColumns = this.getVisibleColumns(breakpoint, context);
    const cardConfig = displayStrategy === 'cards' ? 
      this.getCardFieldConfig(breakpoint, context) : null;

    return {
      ...props,
      
      // Layout configuration
      layoutConfig,
      
      // Table-specific props
      medicalTable: {
        displayStrategy,
        visibleColumns,
        rowDensity: this.getRowDensity(breakpoint, context),
        features: layoutConfig.container.features,
        accessibility: layoutConfig.container.accessibility,
        virtualization: layoutConfig.container.virtualized ? 
          layoutConfig.container.virtualizationProps : null,
        cardConfig
      },
      
      // Responsive configuration
      responsive: {
        breakpoint,
        deviceType: getDeviceType(breakpoint),
        ...layoutConfig,
        medical: true,
        table: true
      }
    };
  }

  /**
   * Debug utility for table layout decisions
   * 
   * @param {string} breakpoint - Current breakpoint
   * @param {Object} context - Context used for calculation
   * @param {Object} result - Calculated result
   */
  debug(breakpoint, context, result) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('table_layout_calculation', 'Medical table layout calculated', {
        component: 'TableLayoutStrategy',
        breakpoint,
        deviceType: getDeviceType(breakpoint),
        context: {
          dataType: context.dataType,
          rowCount: context.rowCount,
          columnCount: context.availableColumns?.length || 0
        },
        result: {
          displayStrategy: this.getDisplayStrategy(breakpoint, context),
          visibleColumns: result.columns,
          rowDensity: this.getRowDensity(breakpoint, context),
          virtualized: result.container?.virtualized || false,
          maxHeight: result.container?.maxHeight
        }
      });
    }
  }
}

/**
 * Create a pre-configured table strategy for common use cases
 * 
 * @param {Object} config - Strategy configuration
 * @returns {TableLayoutStrategy} Configured strategy instance
 */
export function createTableStrategy(config = {}) {
  return new TableLayoutStrategy(config);
}

/**
 * Pre-defined table strategies for common medical data types
 */
export const MEDICAL_TABLE_STRATEGIES = {
  // Patient list table
  patientList: createTableStrategy({
    table: {
      displayStrategy: { xs: 'cards', sm: 'cards', md: 'full_table', lg: 'full_table', xl: 'full_table', xxl: 'full_table' },
      rowDensity: { xs: 'comfortable', sm: 'comfortable', md: 'standard', lg: 'standard', xl: 'compact', xxl: 'compact' }
    }
  }),

  // Lab results table
  labResults: createTableStrategy({
    table: {
      displayStrategy: { xs: 'cards', sm: 'cards', md: 'horizontal_scroll', lg: 'full_table', xl: 'full_table', xxl: 'full_table' },
      rowDensity: { xs: 'comfortable', sm: 'standard', md: 'standard', lg: 'compact', xl: 'compact', xxl: 'compact' }
    }
  }),

  // Medication list table  
  medications: createTableStrategy({
    table: {
      displayStrategy: { xs: 'cards', sm: 'cards', md: 'full_table', lg: 'full_table', xl: 'full_table', xxl: 'full_table' },
      rowDensity: { xs: 'comfortable', sm: 'comfortable', md: 'standard', lg: 'standard', xl: 'standard', xxl: 'compact' }
    }
  }),

  // Compact mobile-first table
  mobileOptimized: createTableStrategy({
    table: {
      displayStrategy: { xs: 'cards', sm: 'cards', md: 'cards', lg: 'horizontal_scroll', xl: 'full_table', xxl: 'full_table' },
      rowDensity: { xs: 'comfortable', sm: 'comfortable', md: 'comfortable', lg: 'standard', xl: 'standard', xxl: 'standard' },
      cardLayout: {
        showFields: { xs: 2, sm: 3, md: 3, lg: 4, xl: 4, xxl: 4 }
      }
    }
  }),

  // Desktop-optimized table with many columns
  desktopComprehensive: createTableStrategy({
    table: {
      displayStrategy: { xs: 'cards', sm: 'cards', md: 'horizontal_scroll', lg: 'full_table', xl: 'full_table', xxl: 'full_table' },
      rowDensity: { xs: 'standard', sm: 'standard', md: 'compact', lg: 'compact', xl: 'compact', xxl: 'compact' },
      virtualization: {
        threshold: { xs: 15, sm: 20, md: 30, lg: 50, xl: 100, xxl: 150 }
      }
    }
  })
};

export default TableLayoutStrategy;