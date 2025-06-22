from typing import Dict, List, Optional

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import Pharmacy as PharmacyModel
from app.schemas.pharmacy import PharmacyCreate, PharmacyUpdate


class CRUDPharmacy(CRUDBase[PharmacyModel, PharmacyCreate, PharmacyUpdate]):
    """
    Pharmacy-specific CRUD operations for medical records system.

    Pharmacies are independent entities representing medication providers.
    They can be referenced by medications and other related models.
    """

    def get_by_name(self, db: Session, *, name: str) -> Optional[PharmacyModel]:
        """
        Retrieve a pharmacy by exact name match.

        Args:
            db: SQLAlchemy database session
            name: Full name of the pharmacy

        Returns:
            Pharmacy object if found, None otherwise

        Example:
            pharmacy = pharmacy_crud.get_by_name(db, name="CVS Pharmacy - Main Street")
        """
        pharmacies = super().get_by_field(
            db=db,
            field_name="name",
            field_value=name,
            limit=1,
        )
        return pharmacies[0] if pharmacies else None

    def search_by_name(
        self, db: Session, *, name: str, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Search pharmacies by partial name match.

        Args:
            db: SQLAlchemy database session
            name: Partial name to search for
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects matching the search

        Example:
            pharmacies = pharmacy_crud.search_by_name(db, name="CVS")
        """
        return super().search_by_text_field(
            db=db,
            field_name="name",
            search_term=name,
            skip=skip,
            limit=limit,
        )

    def search_by_brand(
        self, db: Session, *, brand: str, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Search pharmacies by partial brand match.

        Args:
            db: SQLAlchemy database session
            brand: Partial brand to search for
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects matching the search

        Example:
            pharmacies = pharmacy_crud.search_by_brand(db, brand="CVS")
        """
        return super().search_by_text_field(
            db=db,
            field_name="brand",
            search_term=brand,
            skip=skip,
            limit=limit,
        )

    def get_by_brand(
        self, db: Session, *, brand: str, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Retrieve pharmacies by exact brand match.

        Args:
            db: SQLAlchemy database session
            brand: Brand name to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects with matching brand

        Example:
            cvs_pharmacies = pharmacy_crud.get_by_brand(db, brand="CVS")
        """
        return super().get_by_field(
            db=db,
            field_name="brand",
            field_value=brand,
            skip=skip,
            limit=limit,
        )

    def get_all_brands(self, db: Session) -> List[str]:
        """
        Get a list of all unique brands in the system.

        Args:
            db: SQLAlchemy database session

        Returns:
            List of unique brand strings

        Example:
            brands = pharmacy_crud.get_all_brands(db)
            # Returns: ["CVS", "Walgreens", "Rite Aid", ...]
        """
        result = (
            db.query(distinct(PharmacyModel.brand))
            .filter(PharmacyModel.brand.isnot(None))
            .all()
        )

        return sorted([row[0] for row in result if row[0]])

    def get_all_cities(self, db: Session, *, state: Optional[str] = None) -> List[str]:
        """
        Get a list of all unique cities in the system, optionally filtered by state.

        Args:
            db: SQLAlchemy database session
            state: Optional state to filter cities by

        Returns:
            List of unique city strings

        Example:
            cities = pharmacy_crud.get_all_cities(db, state="NC")
            # Returns: ["Raleigh", "Durham", "Chapel Hill", ...]
        """
        query = db.query(distinct(PharmacyModel.city)).filter(
            PharmacyModel.city.isnot(None)
        )

        if state:
            query = query.filter(PharmacyModel.state.ilike(state))

        result = query.all()
        return sorted([row[0] for row in result if row[0]])

    def search_by_location(
        self,
        db: Session,
        *,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Search pharmacies by location parameters.

        Args:
            db: SQLAlchemy database session
            city: City to search for (partial match)
            state: State to search for (partial match)
            zip_code: ZIP code to search for (exact match)
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects matching the location criteria
        """
        # Build filters dictionary
        filters = {}
        if zip_code:
            filters["zip_code"] = zip_code

        # Use text search for city and state if provided
        if city and state:
            # If both city and state provided, use text search on city with state filter
            return super().search_by_text_field(
                db=db,
                field_name="city",
                search_term=city,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif city:
            return super().search_by_text_field(
                db=db,
                field_name="city",
                search_term=city,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif state:
            return super().search_by_text_field(
                db=db,
                field_name="state",
                search_term=state,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif zip_code:
            return super().get_by_field(
                db=db,
                field_name="zip_code",
                field_value=zip_code,
                skip=skip,
                limit=limit,
            )
        else:
            # No filters provided, return all with pagination
            return self.get_multi(db, skip=skip, limit=limit)

    def get_by_store_number(
        self, db: Session, *, brand: str, store_number: str
    ) -> Optional[PharmacyModel]:
        """
        Retrieve a pharmacy by brand and store number combination.

        Args:
            db: SQLAlchemy database session
            brand: Brand name to filter by
            store_number: Store number to filter by

        Returns:
            Pharmacy object if found, None otherwise

        Example:
            pharmacy = pharmacy_crud.get_by_store_number(db, brand="CVS", store_number="12345")
        """
        pharmacies = super().get_by_field(
            db=db,
            field_name="brand",
            field_value=brand,
            additional_filters={"store_number": store_number},
            limit=1,
        )
        return pharmacies[0] if pharmacies else None

    def get_by_zip_code(
        self, db: Session, *, zip_code: str, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Retrieve pharmacies by ZIP code.

        Args:
            db: SQLAlchemy database session
            zip_code: ZIP code to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects in the specified ZIP code

        Example:
            pharmacies = pharmacy_crud.get_by_zip_code(db, zip_code="27601")
        """
        return super().get_by_field(
            db=db,
            field_name="zip_code",
            field_value=zip_code,
            skip=skip,
            limit=limit,
        )

    def get_24_hour_pharmacies(
        self, db: Session, *, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Retrieve pharmacies that are open 24 hours.

        Args:
            db: SQLAlchemy database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of 24-hour Pharmacy objects

        Example:
            pharmacies = pharmacy_crud.get_24_hour_pharmacies(db)
        """
        return super().get_by_field(
            db=db,
            field_name="twenty_four_hour",
            field_value=True,
            skip=skip,
            limit=limit,
        )

    def get_drive_through_pharmacies(
        self, db: Session, *, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Retrieve pharmacies that have drive-through service.

        Args:
            db: SQLAlchemy database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects with drive-through service

        Example:
            pharmacies = pharmacy_crud.get_drive_through_pharmacies(db)
        """
        return super().get_by_field(
            db=db,
            field_name="drive_through",
            field_value=True,
            skip=skip,
            limit=limit,
        )

    def get_with_medications(
        self, db: Session, pharmacy_id: int
    ) -> Optional[PharmacyModel]:
        """
        Retrieve a pharmacy with all associated medications loaded.
        Shows all medications dispensed by this pharmacy.

        Args:
            db: SQLAlchemy database session
            pharmacy_id: ID of the pharmacy to retrieve

        Returns:
            Pharmacy object with medications relationship loaded, or None if not found

        Example:
            pharmacy = pharmacy_crud.get_with_medications(db, pharmacy_id=5)
        """
        return super().get_with_relations(
            db=db, record_id=pharmacy_id, relations=["medications"]
        )

    def is_name_taken(
        self, db: Session, *, name: str, exclude_id: Optional[int] = None
    ) -> bool:
        """
        Check if a pharmacy name is already taken.

        Args:
            db: SQLAlchemy database session
            name: Name to check
            exclude_id: Optional pharmacy ID to exclude from check (for updates)

        Returns:
            True if name is taken, False if available

        Example:
            if pharmacy_crud.is_name_taken(db, name="CVS Main Street"):
                raise HTTPException(400, "Pharmacy already exists")
        """
        pharmacies = super().get_by_field(
            db=db,
            field_name="name",
            field_value=name,
            limit=1,
        )

        if not pharmacies:
            return False

        if exclude_id and pharmacies[0].id == exclude_id:
            return False

        return True

    def create_if_not_exists(
        self, db: Session, *, pharmacy_data: PharmacyCreate
    ) -> PharmacyModel:
        """
        Create a pharmacy only if one with the same name doesn't already exist.
        If it exists, return the existing pharmacy.

        Args:
            db: SQLAlchemy database session
            pharmacy_data: Pharmacy creation data

        Returns:
            New or existing Pharmacy object

        Example:
            pharmacy_data = PharmacyCreate(name="CVS Main Street", brand="CVS")
            pharmacy = pharmacy_crud.create_if_not_exists(db, pharmacy_data=pharmacy_data)
        """
        # Check if pharmacy already exists
        existing = self.get_by_name(db, name=pharmacy_data.name)
        if existing:
            return existing

        # Create new pharmacy
        return self.create(db, obj_in=pharmacy_data)

    def count_by_brand(self, db: Session) -> Dict[str, int]:
        """
        Count pharmacies by brand.

        Args:
            db: SQLAlchemy database session

        Returns:
            Dictionary mapping brand names to counts

        Example:
            counts = pharmacy_crud.count_by_brand(db)
            # Returns: {"CVS": 150, "Walgreens": 120, "Rite Aid": 85, ...}
        """
        result = (
            db.query(PharmacyModel.brand, func.count(PharmacyModel.id))
            .filter(PharmacyModel.brand.isnot(None))
            .group_by(PharmacyModel.brand)
            .all()
        )

        return {brand: count for brand, count in result}

    def count_by_state(self, db: Session) -> Dict[str, int]:
        """
        Count pharmacies by state.

        Args:
            db: SQLAlchemy database session

        Returns:
            Dictionary mapping state names to counts

        Example:
            counts = pharmacy_crud.count_by_state(db)
            # Returns: {"NC": 245, "SC": 180, "VA": 210, ...}
        """
        result = (
            db.query(PharmacyModel.state, func.count(PharmacyModel.id))
            .filter(PharmacyModel.state.isnot(None))
            .group_by(PharmacyModel.state)
            .all()
        )

        return {state: count for state, count in result}

    def get_most_referenced(
        self, db: Session, *, limit: int = 10
    ) -> List[PharmacyModel]:
        """
        Get the most referenced pharmacies (by medication count).

        Args:
            db: SQLAlchemy database session
            limit: Maximum number of pharmacies to return

        Returns:
            List of most referenced Pharmacy objects

        Example:
            popular = pharmacy_crud.get_most_referenced(db, limit=5)
        """
        from sqlalchemy import func

        from app.models.models import Medication

        return (
            db.query(PharmacyModel)
            .join(Medication, PharmacyModel.id == Medication.pharmacy_id)
            .group_by(PharmacyModel.id)
            .order_by(func.count(Medication.id).desc())
            .limit(limit)
            .all()
        )

    def get_nearby_pharmacies(
        self,
        db: Session,
        *,
        zip_code: str,
        radius_miles: int = 10,
        skip: int = 0,
        limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Get pharmacies near a specific ZIP code.

        Note: This is a simplified implementation that just returns
        pharmacies in the same ZIP code. For true geographic search,
        you would need to implement proper distance calculation.

        Args:
            db: SQLAlchemy database session
            zip_code: ZIP code to search near
            radius_miles: Search radius in miles (not implemented in this version)
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of nearby Pharmacy objects

        Example:
            nearby = pharmacy_crud.get_nearby_pharmacies(db, zip_code="27601", radius_miles=5)
        """
        return self.get_by_zip_code(db, zip_code=zip_code, skip=skip, limit=limit)

    def search_comprehensive(
        self,
        db: Session,
        *,
        name: Optional[str] = None,
        brand: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        drive_through: Optional[bool] = None,
        twenty_four_hour: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Comprehensive search across multiple pharmacy fields.

        Args:
            db: SQLAlchemy database session
            name: Partial name to search for
            brand: Partial brand to search for
            city: Partial city to search for
            state: Partial state to search for
            zip_code: Exact ZIP code to search for
            drive_through: Filter by drive-through availability
            twenty_four_hour: Filter by 24-hour availability
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects matching the search criteria
        """
        # Build filters for exact matches
        filters = {}
        if zip_code:
            filters["zip_code"] = zip_code
        if drive_through is not None:
            filters["drive_through"] = drive_through
        if twenty_four_hour is not None:
            filters["twenty_four_hour"] = twenty_four_hour

        # Determine which field to use for text search (prioritize name)
        if name:
            return super().search_by_text_field(
                db=db,
                field_name="name",
                search_term=name,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif brand:
            return super().search_by_text_field(
                db=db,
                field_name="brand",
                search_term=brand,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif city:
            return super().search_by_text_field(
                db=db,
                field_name="city",
                search_term=city,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif state:
            return super().search_by_text_field(
                db=db,
                field_name="state",
                search_term=state,
                additional_filters=filters,
                skip=skip,
                limit=limit,
            )
        elif filters:
            # Only exact filters provided, use get_by_field with first filter
            first_filter = next(iter(filters.items()))
            remaining_filters = {
                k: v for k, v in filters.items() if k != first_filter[0]
            }
            return super().get_by_field(
                db=db,
                field_name=first_filter[0],
                field_value=first_filter[1],
                additional_filters=remaining_filters,
                skip=skip,
                limit=limit,
            )
        else:
            # No filters provided, return all with pagination
            return self.get_multi(db, skip=skip, limit=limit)


# Create the pharmacy CRUD instance
pharmacy = CRUDPharmacy(PharmacyModel)
