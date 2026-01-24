// Type definitions for existing JavaScript modules

// API Service
declare module '../services/api' {
  interface ApiService {
    get(url: string, config?: any): Promise<any>;
    post(url: string, data?: any, config?: any): Promise<any>;
    put(url: string, data?: any, config?: any): Promise<any>;
    delete(url: string, config?: any): Promise<any>;
  }

  const apiService: ApiService;
  export default apiService;
}

// Logger Service
declare module '../services/logger' {
  interface Logger {
    info(message: string, data?: Record<string, any>): void;
    warn(message: string, data?: Record<string, any>): void;
    error(message: string, data?: Record<string, any>): void;
    debug(message: string, data?: Record<string, any>): void;
  }

  const logger: Logger;
  export default logger;
}

// Medical Page Configs
declare module '../utils/medicalPageConfigs' {
  export interface FilterOption {
    value: string;
    label: string;
    description?: string;
  }

  export interface SortOption {
    value: string;
    label: string;
    description?: string;
  }

  export interface PageConfigFiltering {
    searchFields: string[];
    statusField?: string;
    statusOptions?: FilterOption[];
    categoryField?: string;
    categoryLabel?: string;
    categoryOptions?: FilterOption[];
    dateField?: string;
    startDateField?: string;
    endDateField?: string;
    dateRangeOptions?: FilterOption[];
    customFilters?: Record<string, (item: any, filterValue: string, additionalData?: any) => boolean>;
    customSearchFunction?: (item: any, searchTerm: string) => boolean;
    additionalFilters?: Array<{
      field: string;
      label: string;
      options: FilterOption[];
    }>;
    [key: string]: any;
  }

  export interface PageConfigSorting {
    defaultSortBy: string;
    defaultSortOrder: 'asc' | 'desc';
    sortOptions: SortOption[];
    sortTypes?: Record<string, string>;
    customSortFunctions?: Record<string, (a: any, b: any, sortOrder?: string) => number>;
  }

  export interface PageConfigFilterControls {
    searchPlaceholder: string;
    title: string;
    showStatus?: boolean;
    showCategory?: boolean;
    showDateRange?: boolean;
    showAdditionalFilters?: boolean;
    description?: string;
    [key: string]: any;
  }

  export interface TableColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (value: any, row?: any) => any;
    style?: (row: any) => Record<string, string>;
  }

  export interface PageConfig {
    filtering: PageConfigFiltering;
    sorting: PageConfigSorting;
    filterControls: PageConfigFilterControls;
    table?: {
      columns: TableColumn[];
      actions?: Record<string, (row: any) => any>;
    };
  }

  export const SEARCH_TERM_MAX_LENGTH: number;

  export const conditionsPageConfig: PageConfig;
  export const insurancesPageConfig: PageConfig;
  export const medicationsPageConfig: PageConfig;
  export const proceduresPageConfig: PageConfig;
  export const treatmentsPageConfig: PageConfig;
  export const visitsPageConfig: PageConfig;
  export const immunizationsPageConfig: PageConfig;
  export const allergiesPageConfig: PageConfig;
  export const symptomsPageConfig: PageConfig;
  export const practitionersPageConfig: PageConfig;
  export const pharmaciesPageConfig: PageConfig;
  export const labresultsPageConfig: PageConfig;
  export const vitalsPageConfig: PageConfig;
  export const emergencyContactsPageConfig: PageConfig;
  export const familyMembersPageConfig: PageConfig;

  export const medicalPageConfigs: Record<string, PageConfig>;
  export function getMedicalPageConfig(pageName: string): PageConfig;
}

// Medical Form Fields
declare module '../utils/medicalFormFields' {
  export interface FormField {
    name: string;
    type: string;
    label?: string;
    labelKey?: string;
    placeholder?: string;
    placeholderKey?: string;
    required?: boolean;
    description?: string;
    descriptionKey?: string;
    gridColumn?: number;
    options?: Array<{ value: string; label?: string; labelKey?: string }>;
    optionsKey?: string;
    searchable?: boolean;
    clearable?: boolean;
    dynamicOptions?: string;
    minLength?: number;
    maxLength?: number;
    minRows?: number;
    maxRows?: number;
    maxDate?: () => Date;
    maxDropdownHeight?: number;
    min?: number;
    max?: number;
    step?: number;
    component?: string;
    maxTags?: number;
    showFor?: string[];
    requiredFor?: string[];
  }

  export const tagsFieldConfig: FormField;
  export const allergyFormFields: FormField[];
  export const conditionFormFields: FormField[];
  export const medicationFormFields: FormField[];
  export const labResultFormFields: FormField[];
  export const immunizationFormFields: FormField[];
  export const procedureFormFields: FormField[];
  export const practitionerFormFields: FormField[];
  export const emergencyContactFormFields: FormField[];
  export const visitFormFields: FormField[];
  export const pharmacyFormFields: FormField[];
  export const treatmentFormFields: FormField[];
  export const familyMemberFormFields: FormField[];
  export const familyConditionFormFields: FormField[];
  export const insuranceFormFields: FormField[];
  export const symptomParentFormFields: FormField[];
  export const symptomOccurrenceFormFields: FormField[];
  export function getFormFields(formType: string): FormField[];
}

// Global type extensions
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: any;
  }
}
