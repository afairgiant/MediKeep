import type { FC, HTMLAttributes, ReactNode } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

declare const Alert: FC<AlertProps>;
export { Alert };
export default Alert;
