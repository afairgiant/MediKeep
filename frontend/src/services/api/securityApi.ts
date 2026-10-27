/**
 * API service for the signed-in user's two-factor and session settings
 */
import { apiService } from './index';

export type TwoFactorBlockedReason =
  | 'sso_account'
  | 'sso_only_mode'
  | 'secret_key_not_configured'
  | 'disabled_by_operator';

export interface TwoFactorStatus {
  totp_enabled: boolean;
  backup_codes_remaining: number;
  enrollment_allowed: boolean;
  blocked_reason: TwoFactorBlockedReason | null;
}

export interface TotpSetup {
  secret: string;
  otpauth_uri: string;
}

export interface BackupCodes {
  backup_codes: string[];
}

const BASE = '/users/me';

export const getTwoFactorStatus = (
  signal?: AbortSignal
): Promise<TwoFactorStatus> => apiService.get(`${BASE}/two-factor`, { signal });

/** Starts enrollment; nothing is turned on until confirmTotpSetup succeeds. */
export const startTotpSetup = (currentPassword: string): Promise<TotpSetup> =>
  apiService.post(`${BASE}/two-factor/totp/setup`, {
    current_password: currentPassword,
  });

/** Turns two-factor on and signs out other sessions. The codes are shown only once. */
export const confirmTotpSetup = (code: string): Promise<BackupCodes> =>
  apiService.post(`${BASE}/two-factor/totp/confirm`, { code });

/** Turns two-factor off and signs out other sessions. code may be a backup code. */
export const disableTwoFactor = (
  currentPassword: string,
  code: string
): Promise<unknown> =>
  apiService.post(`${BASE}/two-factor/disable`, {
    current_password: currentPassword,
    code,
  });

/** Replaces every backup code; the old ones stop working. */
export const regenerateBackupCodes = (
  currentPassword: string,
  code: string
): Promise<BackupCodes> =>
  apiService.post(`${BASE}/two-factor/backup-codes/regenerate`, {
    current_password: currentPassword,
    code,
  });

/** Signs out every other session; this one continues. */
export const revokeOtherSessions = (): Promise<unknown> =>
  apiService.post(`${BASE}/sessions/revoke-others`, {});
