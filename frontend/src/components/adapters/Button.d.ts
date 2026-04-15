import type { ButtonHTMLAttributes, FC, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  children?: ReactNode;
}

declare const Button: FC<ButtonProps>;
export { Button };
export default Button;
