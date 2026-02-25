import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  children?: React.ReactNode;
}

declare const Button: React.FC<ButtonProps>;
export { Button };
export default Button;
