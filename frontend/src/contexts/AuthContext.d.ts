import type { ReactNode, ReactElement } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  fullName?: string;
  full_name?: string;
  isAdmin?: boolean;
  must_change_password?: boolean;
  [key: string]: unknown;
}

export interface AuthContextType {
  // State
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionTimeoutMinutes: number;
  mustChangePassword: boolean;

  // Actions
  login: (
    credentialsOrUser: { username: string; password: string } | AuthUser,
    tokenFromSSO?: string | null
  ) => Promise<{ success: boolean; isFirstLogin?: boolean; mustChangePassword?: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateActivity: () => void;
  clearError: () => void;
  clearMustChangePassword: () => void;
  updateUser: (data: Partial<AuthUser>) => AuthUser;
  updateSessionTimeout: (minutes: number) => void;

  // Utilities
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  shouldShowProfilePrompts: (patient: unknown) => boolean;
  checkIsFirstLogin: () => boolean;
}

export function useAuth(): AuthContextType;
export function AuthProvider(props: { children: ReactNode }): ReactElement;
declare const AuthContext: import('react').Context<AuthContextType | null>;
export default AuthContext;
