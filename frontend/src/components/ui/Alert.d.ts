import type { HTMLAttributes } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

declare const Alert: React.FC<AlertProps>;
export { Alert };
export default Alert;
