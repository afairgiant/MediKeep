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
