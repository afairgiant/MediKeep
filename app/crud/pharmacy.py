from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

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
        return db.query(PharmacyModel).filter(PharmacyModel.name == name).first()

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
        search_pattern = f"%{name}%"
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.name.ilike(search_pattern))
            .offset(skip)
            .limit(limit)
            .all()
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
        search_pattern = f"%{brand}%"
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.brand.ilike(search_pattern))
            .offset(skip)
            .limit(limit)
            .all()
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
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.brand.ilike(brand))
            .offset(skip)
            .limit(limit)
            .all()
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
        query = db.query(PharmacyModel)
        
        if city:
            query = query.filter(PharmacyModel.city.ilike(f"%{city}%"))
        
        if state:
            query = query.filter(PharmacyModel.state.ilike(f"%{state}%"))
        
        if zip_code:
            query = query.filter(PharmacyModel.zip_code == zip_code)
        
        return query.offset(skip).limit(limit).all()

    def get_by_store_number(
        self, db: Session, *, brand: str, store_number: str
    ) -> Optional[PharmacyModel]:
        """
        Retrieve a pharmacy by brand and store number combination.

        Args:
            db: SQLAlchemy database session
            brand: Brand name of the pharmacy
            store_number: Store number within the brand

        Returns:
            Pharmacy object if found, None otherwise
        """
        return db.query(PharmacyModel).filter(
            PharmacyModel.brand.ilike(brand),
            PharmacyModel.store_number == store_number
        ).first()

    def get_by_zip_code(
        self, db: Session, *, zip_code: str, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Get all pharmacies in a specific ZIP code.

        Args:
            db: SQLAlchemy database session
            zip_code: ZIP code to search for
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects in the specified ZIP code
        """
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.zip_code == zip_code)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_24_hour_pharmacies(
        self, db: Session, *, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Get all 24-hour pharmacies.

        Args:
            db: SQLAlchemy database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of 24-hour Pharmacy objects        """
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.twenty_four_hour.is_(True))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_drive_through_pharmacies(
        self, db: Session, *, skip: int = 0, limit: int = 20
    ) -> List[PharmacyModel]:
        """
        Get all pharmacies with drive-through service.

        Args:
            db: SQLAlchemy database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects with drive-through service        """
        return (
            db.query(PharmacyModel)
            .filter(PharmacyModel.drive_through.is_(True))
            .offset(skip)
            .limit(limit)
            .all()
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
            Pharmacy object with all medication relationships loaded, or None if not found

        Example:
            pharmacy = pharmacy_crud.get_with_medications(db, pharmacy_id=5)
        """
        from sqlalchemy.orm import joinedload

        return (
            db.query(PharmacyModel)
            .options(joinedload(PharmacyModel.medications))
            .filter(PharmacyModel.id == pharmacy_id)
            .first()
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
            if pharmacy_crud.is_name_taken(db, name="CVS - Main St"):
                raise HTTPException(400, "Pharmacy already exists")
        """
        query = db.query(PharmacyModel).filter(PharmacyModel.name == name)

        if exclude_id:
            query = query.filter(PharmacyModel.id != exclude_id)

        return query.first() is not None

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
            pharmacy_data = PharmacyCreate(name="CVS - Main St", brand="CVS", ...)
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
            Dictionary with brand as key and count as value

        Example:
            counts = pharmacy_crud.count_by_brand(db)
            # Returns: {"CVS": 15, "Walgreens": 12, ...}
        """
        result = (
            db.query(
                PharmacyModel.brand,
                func.count(PharmacyModel.id).label("count"),
            )
            .filter(PharmacyModel.brand.isnot(None))
            .group_by(PharmacyModel.brand)
            .all()
        )

        return {row[0]: row[1] for row in result if row[0]}

    def count_by_state(self, db: Session) -> Dict[str, int]:
        """
        Count pharmacies by state.

        Args:
            db: SQLAlchemy database session

        Returns:
            Dictionary with state as key and count as value

        Example:
            counts = pharmacy_crud.count_by_state(db)
            # Returns: {"NC": 25, "SC": 18, ...}
        """
        result = (
            db.query(
                PharmacyModel.state,
                func.count(PharmacyModel.id).label("count"),
            )
            .group_by(PharmacyModel.state)
            .all()
        )

        return {row[0]: row[1] for row in result}

    def get_most_referenced(
        self, db: Session, *, limit: int = 10
    ) -> List[PharmacyModel]:
        """
        Get pharmacies that are most frequently referenced in medication records.
        Useful for showing popular/commonly used pharmacies.

        Args:
            db: SQLAlchemy database session
            limit: Maximum number of pharmacies to return

        Returns:
            List of pharmacies ordered by frequency of use

        Example:
            popular_pharmacies = pharmacy_crud.get_most_referenced(db, limit=5)
        """
        # Count references in medications
        subquery = (
            db.query(
                PharmacyModel.id,
                func.count(PharmacyModel.medications).label("medication_count"),
            )
            .outerjoin(PharmacyModel.medications)
            .group_by(PharmacyModel.id)
            .subquery()
        )

        return (
            db.query(PharmacyModel)
            .join(subquery, PharmacyModel.id == subquery.c.id)
            .order_by(subquery.c.medication_count.desc())
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
        Get pharmacies near a given ZIP code.
        
        Note: This is a simplified implementation. In production, you'd want to use
        geographical distance calculations or a geospatial database.

        Args:
            db: SQLAlchemy database session
            zip_code: Center ZIP code to search around
            radius_miles: Search radius in miles (currently unused in this simple implementation)
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of nearby Pharmacy objects

        Example:
            nearby = pharmacy_crud.get_nearby_pharmacies(db, zip_code="27514", radius_miles=5)
        """
        # Simple implementation: return pharmacies in the same ZIP code
        # In production, you'd implement proper geographical distance calculation
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
        Comprehensive search across multiple pharmacy attributes.

        Args:
            db: SQLAlchemy database session
            name: Pharmacy name to search (partial match)
            brand: Brand to search (partial match)
            city: City to search (partial match)
            state: State to search (partial match)
            zip_code: ZIP code to search (exact match)
            drive_through: Filter by drive-through availability
            twenty_four_hour: Filter by 24-hour availability
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Pharmacy objects matching all specified criteria

        Example:
            pharmacies = pharmacy_crud.search_comprehensive(
                db,
                brand="CVS",
                city="Raleigh",
                drive_through=True
            )
        """
        query = db.query(PharmacyModel)

        if name:
            query = query.filter(PharmacyModel.name.ilike(f"%{name}%"))

        if brand:
            query = query.filter(PharmacyModel.brand.ilike(f"%{brand}%"))

        if city:
            query = query.filter(PharmacyModel.city.ilike(f"%{city}%"))

        if state:
            query = query.filter(PharmacyModel.state.ilike(f"%{state}%"))

        if zip_code:
            query = query.filter(PharmacyModel.zip_code == zip_code)

        if drive_through is not None:
            query = query.filter(PharmacyModel.drive_through.is_(drive_through))

        if twenty_four_hour is not None:
            query = query.filter(PharmacyModel.twenty_four_hour.is_(twenty_four_hour))

        return query.offset(skip).limit(limit).all()

# Create an instance of CRUDPharmacy to use throughout the application
pharmacy = CRUDPharmacy(PharmacyModel)