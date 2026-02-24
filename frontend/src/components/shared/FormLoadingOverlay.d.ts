export interface FormLoadingOverlayProps {
  visible: boolean;
  message?: string;
  submessage?: string;
  type?: 'loading' | 'success' | 'error';
  showIcon?: boolean;
  blur?: number;
  opacity?: number;
  zIndex?: number;
}

declare const FormLoadingOverlay: React.FC<FormLoadingOverlayProps>;
export default FormLoadingOverlay;
