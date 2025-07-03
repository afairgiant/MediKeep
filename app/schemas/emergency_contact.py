import re
from typing import Optional

from pydantic import BaseModel, Field, validator


class EmergencyContactBase(BaseModel):
    name: str = Field(
        ..., min_length=2, max_length=100, description="Full name of emergency contact"
    )
    relationship: str = Field(
        ..., min_length=2, max_length=50, description="Relationship to patient"
    )
    phone_number: str = Field(
        ..., min_length=10, max_length=20, description="Primary phone number"
    )
    secondary_phone: Optional[str] = Field(
        None, max_length=20, description="Optional secondary phone number"
    )
    email: Optional[str] = Field(
        None, max_length=100, description="Optional email address"
    )
    is_primary: bool = Field(
        False, description="Whether this is the primary emergency contact"
    )
    is_active: bool = Field(
        True, description="Whether this contact is currently active"
    )
    address: Optional[str] = Field(
        None, max_length=500, description="Contact's address"
    )
    notes: Optional[str] = Field(
        None, max_length=1000, description="Additional notes about the contact"
    )

    @validator("relationship")
    def validate_relationship(cls, v):
        valid_relationships = [
            "spouse",
            "parent",
            "child",
            "sibling",
            "grandparent",
            "grandchild",
            "aunt",
            "uncle",
            "cousin",
            "friend",
            "neighbor",
            "caregiver",
            "guardian",
            "partner",
            "other",
        ]
        if v.lower() not in valid_relationships:
            raise ValueError(
                f"Relationship must be one of: {', '.join(valid_relationships)}"
            )
        return v.lower()

    @validator("phone_number", "secondary_phone")
    def validate_phone_number(cls, v):
        if v is not None and v.strip():
            # Remove all non-digits
            digits_only = re.sub(r"[^\d]", "", v)
            # Check if it's a valid length (10 digits for US, allow international)
            if len(digits_only) < 10 or len(digits_only) > 15:
                raise ValueError("Phone number must be between 10-15 digits")
            return v.strip()
        return v

    @validator("email")
    def validate_email(cls, v):
        if v is not None and v.strip():
            email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(email_pattern, v.strip()):
                raise ValueError("Invalid email format")
            return v.strip().lower()
        return v


class EmergencyContactCreate(EmergencyContactBase):
    pass


class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    relationship: Optional[str] = Field(None, min_length=2, max_length=50)
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    secondary_phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator("relationship")
    def validate_relationship(cls, v):
        if v is not None:
            valid_relationships = [
                "spouse",
                "parent",
                "child",
                "sibling",
                "grandparent",
                "grandchild",
                "aunt",
                "uncle",
                "cousin",
                "friend",
                "neighbor",
                "caregiver",
                "guardian",
                "partner",
                "other",
            ]
            if v.lower() not in valid_relationships:
                raise ValueError(
                    f"Relationship must be one of: {', '.join(valid_relationships)}"
                )
            return v.lower()
        return v

    @validator("phone_number", "secondary_phone")
    def validate_phone_number(cls, v):
        if v is not None and v.strip():
            # Remove all non-digits
            digits_only = re.sub(r"[^\d]", "", v)
            # Check if it's a valid length (10 digits for US, allow international)
            if len(digits_only) < 10 or len(digits_only) > 15:
                raise ValueError("Phone number must be between 10-15 digits")
            return v.strip()
        return v

    @validator("email")
    def validate_email(cls, v):
        if v is not None and v.strip():
            email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(email_pattern, v.strip()):
                raise ValueError("Invalid email format")
            return v.strip().lower()
        return v


class EmergencyContactResponse(EmergencyContactBase):
    id: int
    patient_id: int = Field(..., gt=0, description="ID of the patient")

    class Config:
        from_attributes = True


class EmergencyContactWithRelations(EmergencyContactResponse):
    patient: Optional[dict] = None

    class Config:
        from_attributes = True


class EmergencyContactSummary(BaseModel):
    id: int
    name: str
    relationship: str
    phone_number: str
    is_primary: bool
    is_active: bool
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True
