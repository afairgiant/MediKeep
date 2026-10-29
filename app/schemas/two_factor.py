from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# Loose so spaced-out codes still parse; the service checks the real shape
_CODE = Field(..., min_length=1, max_length=32)
_PASSWORD = Field(..., min_length=1, max_length=256)


class MfaChallenge(BaseModel):
    """Login response when the password was right and a second factor is due."""

    mfa_required: Literal[True] = True
    mfa_ticket: str
    methods: List[str]
    expires_in: int
    # 0 when this server does not offer to remember the device
    remember_device_days: int = 0


class TwoFactorVerifyRequest(BaseModel):
    mfa_ticket: str = Field(..., min_length=1, max_length=128)
    code: str = _CODE
    method: Literal["totp", "backup_code"]
    remember_device: bool = False


class TwoFactorStatus(BaseModel):
    totp_enabled: bool
    backup_codes_remaining: int
    enrollment_allowed: bool
    blocked_reason: Optional[str] = None


class TotpSetupRequest(BaseModel):
    current_password: str = _PASSWORD


class TotpSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TotpConfirmRequest(BaseModel):
    code: str = _CODE


class BackupCodesResponse(BaseModel):
    backup_codes: List[str]


class PasswordAndCodeRequest(BaseModel):
    """Re-authentication for changes that weaken or replace the second factor."""

    current_password: str = _PASSWORD
    code: str = _CODE


class TrustedDeviceOut(BaseModel):
    id: int
    user_agent: Optional[str] = None
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: datetime

    model_config = {"from_attributes": True}
