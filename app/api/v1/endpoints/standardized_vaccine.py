"""
API endpoints for standardized vaccine search and autocomplete.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access, log_endpoint_access
from app.crud import standardized_vaccine
from app.models.enums import VaccineCategory

logger = get_logger(__name__, "app")

router = APIRouter()


class StandardizedVaccineResponse(BaseModel):
    id: int
    who_code: Optional[str]
    vaccine_name: str
    short_name: Optional[str]
    category: Optional[VaccineCategory]
    common_names: Optional[List[str]]
    is_combined: bool
    components: Optional[List[str]]
    default_manufacturer: Optional[str]
    is_common: bool

    model_config = ConfigDict(from_attributes=True)


class VaccineAutocompleteOption(BaseModel):
    value: str
    label: str
    who_code: Optional[str]
    short_name: Optional[str]
    category: Optional[VaccineCategory]
    is_combined: bool
    components: Optional[List[str]]


class VaccineSearchResponse(BaseModel):
    vaccines: List[StandardizedVaccineResponse]
    total: int


@router.get("/search", response_model=VaccineSearchResponse)
def search_standardized_vaccines(
    request: Request,
    query: str = Query(None, description="Search query"),
    category: Optional[VaccineCategory] = Query(
        None, description="Filter by category"
    ),
    limit: int = Query(200, ge=1, le=1000, description="Maximum results"),
    db: Session = Depends(deps.get_db),
):
    """Full-text search across vaccine name, short name, WHO code, and common names."""
    vaccines = standardized_vaccine.search_vaccines(db, query or "", category, limit)

    log_data_access(
        logger,
        request,
        0,
        "read",
        "StandardizedVaccine",
        count=len(vaccines),
        query=query,
        category=category,
    )

    return {"vaccines": vaccines, "total": len(vaccines)}


@router.get("/autocomplete", response_model=List[VaccineAutocompleteOption])
def get_vaccine_autocomplete(
    request: Request,
    query: str = Query("", description="Autocomplete query"),
    category: Optional[VaccineCategory] = Query(
        None, description="Filter by category"
    ),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    db: Session = Depends(deps.get_db),
):
    """Autocomplete suggestions for vaccine names, formatted for the frontend dropdown."""
    options = standardized_vaccine.get_autocomplete_options(
        db, query, category, limit
    )

    log_endpoint_access(
        logger,
        request,
        0,
        "vaccine_autocomplete_requested",
        query=query,
        category=category,
        results_count=len(options),
    )

    return options


@router.get("/common", response_model=List[StandardizedVaccineResponse])
def get_common_vaccines(
    category: Optional[VaccineCategory] = Query(
        None, description="Filter by category"
    ),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    db: Session = Depends(deps.get_db),
):
    """Frequently used vaccines (is_common=true), ordered by display_order."""
    return standardized_vaccine.get_common_vaccines(db, category, limit)


@router.get(
    "/by-category/{category}", response_model=List[StandardizedVaccineResponse]
)
def get_vaccines_by_category(
    category: VaccineCategory, db: Session = Depends(deps.get_db)
):
    """All vaccines in a category (Viral, Bacterial, Combined, Toxoid, Parasitic, Other)."""
    vaccines = standardized_vaccine.get_vaccines_by_category(db, category)

    if not vaccines:
        raise HTTPException(
            status_code=404,
            detail=f"No vaccines found for category: {category.value}",
        )

    return vaccines


@router.get("/by-who-code/{who_code}", response_model=StandardizedVaccineResponse)
def get_vaccine_by_who_code(who_code: str, db: Session = Depends(deps.get_db)):
    """Look up a standardized vaccine by WHO PCMT code."""
    vaccine = standardized_vaccine.get_vaccine_by_who_code(db, who_code)

    if not vaccine:
        raise HTTPException(
            status_code=404,
            detail=f"Vaccine not found with WHO code: {who_code}",
        )

    return vaccine


@router.get(
    "/by-name/{vaccine_name:path}", response_model=StandardizedVaccineResponse
)
def get_vaccine_by_name(vaccine_name: str, db: Session = Depends(deps.get_db)):
    """Case-insensitive exact-name lookup."""
    vaccine = standardized_vaccine.get_vaccine_by_name(db, vaccine_name)

    if not vaccine:
        raise HTTPException(
            status_code=404, detail=f"Vaccine not found: {vaccine_name}"
        )

    return vaccine


@router.get("/count")
def count_vaccines(
    category: Optional[VaccineCategory] = Query(
        None, description="Filter by category"
    ),
    db: Session = Depends(deps.get_db),
):
    """Total count of standardized vaccines."""
    count = standardized_vaccine.count_vaccines(db, category)
    return {"category": category, "count": count}
