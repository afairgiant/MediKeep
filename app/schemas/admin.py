"""
Admin-specific schemas for user management and patient linking.
"""

from typing import Optional
from datetime import date

from pydantic import BaseModel, EmailStr, field_validator, ConfigDict

ALLOWED_ROLES = ("admin", "user", "guest", "doctor", "nurse", "staff")


def _validate_optional_name(v: Optional[str], field_label: str) -> Optional[str]:
    """Validate and normalise an optional name field (first/last name)."""
    if v is None:
        return v
    stripped = v.strip()
    if len(stripped) < 1:
        raise ValueError(f"{field_label} cannot be empty")
    if len(v) > 50:
        raise ValueError(f"{field_label} must be less than 50 characters")
    return stripped.title()


class AdminUserCreateRequest(BaseModel):
    """Schema for admin-initiated user creation with optional patient linking."""

    username: str
    password: str
    email: EmailStr
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"
    link_patient_id: Optional[int] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        stripped = v.strip() if v else ""
        if len(stripped) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if len(stripped) > 50:
            raise ValueError("Username must be less than 50 characters")
        if not stripped.replace("_", "").replace("-", "").isalnum():
            raise ValueError(
                "Username can only contain letters, numbers, underscores, and hyphens"
            )
        return stripped.lower()

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v.lower() not in ALLOWED_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(ALLOWED_ROLES)}")
        return v.lower()

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v):
        stripped = v.strip() if v else ""
        if len(stripped) < 2:
            raise ValueError("Full name must be at least 2 characters long")
        if len(stripped) > 100:
            raise ValueError("Full name must be less than 100 characters")
        return stripped

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long")
        if len(v) > 128:
            raise ValueError("Password must be less than 128 characters")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError(
                "Password must contain at least one letter and one number"
            )
        return v

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v):
        return _validate_optional_name(v, "First name")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        return _validate_optional_name(v, "Last name")

    @field_validator("link_patient_id")
    @classmethod
    def validate_link_patient_id(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Patient ID must be a positive integer")
        return v


class AdminPatientSearchResult(BaseModel):
    """Single patient result for admin search."""

    id: int
    first_name: str
    last_name: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    owner_user_id: Optional[int] = None
    owner_username: Optional[str] = None
    owner_full_name: Optional[str] = None
    is_self_record: bool = False

    model_config = ConfigDict(from_attributes=True)


class AdminPatientSearchResponse(BaseModel):
    """Wrapper for admin patient search results."""

    patients: list[AdminPatientSearchResult]
    total_count: int
