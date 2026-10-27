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

export type TwoFactorMethod = 'totp' | 'backup_code';

export interface LoginResult {
  success: boolean;
  mfaRequired?: false;
  isFirstLogin?: boolean;
  mustChangePassword?: boolean;
  error?: string;
}

/** The password was right; finish with completeTwoFactorLogin. */
export interface TwoFactorChallengeResult {
  success: true;
  mfaRequired: true;
  mfaTicket: string;
  methods: TwoFactorMethod[];
}

/** Sent with a refused code or password: tries left, and what the last one ends in. */
export interface AttemptsLeft {
  attempts_remaining: number;
  after_last: 'wait' | 'sign_in_again';
}

export interface TwoFactorLoginResult extends LoginResult {
  errorCode?: string | null;
  data?: AttemptsLeft | null;
  backupCodesRemaining?: number | null;
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
    ssoOptions?: { sso: boolean; mustChangePassword?: boolean } | null
  ) => Promise<LoginResult | TwoFactorChallengeResult>;
  /** Second step after login() returned mfaRequired. Refusals are returned, not stored. */
  completeTwoFactorLogin: (
    mfaTicket: string,
    code: string,
    method: TwoFactorMethod
  ) => Promise<TwoFactorLoginResult>;
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
