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
    label: string;
    placeholder?: string;
    required?: boolean;
    description?: string;
    gridColumn?: number;
    options?: Array<{ value: string; label: string }>;
    searchable?: boolean;
    clearable?: boolean;
    dynamicOptions?: string;
    minLength?: number;
    maxLength?: number;
    minRows?: number;
    maxRows?: number;
    maxDate?: () => Date;
    maxDropdownHeight?: number;
  }

  export const medicationFormFields: FormField[];
  export const allergyFormFields: FormField[];
  export const conditionFormFields: FormField[];
  export const procedureFormFields: FormField[];
  export const immunizationFormFields: FormField[];
  export const treatmentFormFields: FormField[];
  export const encounterFormFields: FormField[];
  export const labResultFormFields: FormField[];
}

// Global type extensions
declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: any;
  }
}