import type { FC } from 'react';

export interface FormLoadingOverlayProps {
  visible: boolean;
  message?: string;
  submessage?: string;
  type?: 'loading' | 'success' | 'error';
  showIcon?: boolean;
  blur?: number;
  opacity?: number;
  zIndex?: number;
  variant?: 'default' | 'frosted';
}

declare const FormLoadingOverlay: FC<FormLoadingOverlayProps>;
export default FormLoadingOverlay;
