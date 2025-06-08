from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, validator


class ImmunizationBase(BaseModel):
    vaccine_name: str = Field(
        ..., min_length=2, max_length=200, description="Name of the vaccine"
    )
    date_administered: date = Field(
        ..., description="Date when the vaccine was administered"
    )
    dose_number: Optional[int] = Field(
        None, ge=1, description="Dose number in the series"
    )
    lot_number: Optional[str] = Field(
        None, max_length=50, description="Vaccine lot number"
    )
    manufacturer: Optional[str] = Field(
        None, max_length=200, description="Vaccine manufacturer"
    )
    site: Optional[str] = Field(None, max_length=100, description="Injection site")
    route: Optional[str] = Field(
        None, max_length=50, description="Route of administration"
    )
    expiration_date: Optional[date] = Field(None, description="Vaccine expiration date")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    patient_id: int = Field(..., gt=0, description="ID of the patient")
    practitioner_id: Optional[int] = Field(
        None, gt=0, description="ID of the administering practitioner"
    )

    @validator("date_administered")
    def validate_date_administered(cls, v):
        if v > date.today():
            raise ValueError("Administration date cannot be in the future")
        return v

    @validator("expiration_date")
    def validate_expiration_date(cls, v, values):
        if v and "date_administered" in values and v < values["date_administered"]:
            raise ValueError("Expiration date cannot be before administration date")
        return v

    @validator("route")
    def validate_route(cls, v):
        if v:
            valid_routes = [
                "intramuscular",
                "subcutaneous",
                "intradermal",
                "oral",
                "nasal",
            ]
            if v.lower() not in valid_routes:
                raise ValueError(f"Route must be one of: {', '.join(valid_routes)}")
            return v.lower()
        return v


class ImmunizationCreate(ImmunizationBase):
    pass


class ImmunizationUpdate(BaseModel):
    vaccine_name: Optional[str] = Field(None, min_length=2, max_length=200)
    date_administered: Optional[date] = None
    dose_number: Optional[int] = Field(None, ge=1)
    lot_number: Optional[str] = Field(None, max_length=50)
    manufacturer: Optional[str] = Field(None, max_length=200)
    site: Optional[str] = Field(None, max_length=100)
    route: Optional[str] = Field(None, max_length=50)
    expiration_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=1000)
    practitioner_id: Optional[int] = Field(None, gt=0)

    @validator("date_administered")
    def validate_date_administered(cls, v):
        if v and v > date.today():
            raise ValueError("Administration date cannot be in the future")
        return v

    @validator("expiration_date")
    def validate_expiration_date(cls, v, values):
        if (
            v
            and "date_administered" in values
            and values["date_administered"]
            and v < values["date_administered"]
        ):
            raise ValueError("Expiration date cannot be before administration date")
        return v

    @validator("route")
    def validate_route(cls, v):
        if v:
            valid_routes = [
                "intramuscular",
                "subcutaneous",
                "intradermal",
                "oral",
                "nasal",
            ]
            if v.lower() not in valid_routes:
                raise ValueError(f"Route must be one of: {', '.join(valid_routes)}")
            return v.lower()
        return v


class ImmunizationResponse(ImmunizationBase):
    id: int

    class Config:
        from_attributes = True


class ImmunizationWithRelations(ImmunizationResponse):
    patient: Optional[dict] = None
    practitioner: Optional[dict] = None

    class Config:
        from_attributes = True


class ImmunizationSummary(BaseModel):
    id: int
    vaccine_name: str
    date_administered: date
    dose_number: Optional[int]
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None

    class Config:
        from_attributes = True
