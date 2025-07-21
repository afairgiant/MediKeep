from datetime import datetime
from typing import Optional

from pydantic import BaseModel, validator


class UserPreferencesBase(BaseModel):
    """Base User Preferences schema with common fields."""

    unit_system: str

    @validator("unit_system")
    def validate_unit_system(cls, v):
        """
        Validate that the unit system is one of the allowed values.

        Args:
            v: The unit system value to validate

        Returns:
            Cleaned unit system (lowercase)

        Raises:
            ValueError: If unit system is not in allowed list
        """
        allowed_systems = ["imperial", "metric"]
        if v.lower() not in allowed_systems:
            raise ValueError(
                f"Unit system must be one of: {', '.join(allowed_systems)}"
            )
        return v.lower()


class UserPreferencesCreate(UserPreferencesBase):
    """Schema for creating user preferences."""

    pass


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences."""

    unit_system: Optional[str] = None

    @validator("unit_system")
    def validate_unit_system(cls, v):
        """Validate unit system if provided."""
        if v is not None:
            allowed_systems = ["imperial", "metric"]
            if v.lower() not in allowed_systems:
                raise ValueError(
                    f"Unit system must be one of: {', '.join(allowed_systems)}"
                )
            return v.lower()
        return v


class UserPreferences(UserPreferencesBase):
    """Schema for reading/returning user preferences data."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic configuration for SQLAlchemy compatibility."""

        from_attributes = True
