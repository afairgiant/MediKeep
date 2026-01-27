"""
CRUD operations for InjuryType entity.

InjuryType represents reusable injury types that populate the dropdown.
"""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import InjuryType
from app.schemas.injury_type import InjuryTypeCreate, InjuryTypeUpdate


class CRUDInjuryType(CRUDBase[InjuryType, InjuryTypeCreate, InjuryTypeUpdate]):
    """
    CRUD operations for InjuryType model.

    Provides methods for managing reusable injury types.
    System types (is_system=True) cannot be deleted.
    """

    def get_all(self, db: Session) -> List[InjuryType]:
        """
        Get all injury types (for dropdown).

        Returns:
            List of all injury types, ordered by name
        """
        return (
            db.query(self.model)
            .order_by(self.model.name)
            .all()
        )

    def get_by_name(self, db: Session, *, name: str) -> Optional[InjuryType]:
        """
        Find an injury type by name (case-insensitive).

        Args:
            db: Database session
            name: Type name to search for

        Returns:
            InjuryType if found, None otherwise
        """
        return (
            db.query(self.model)
            .filter(self.model.name.ilike(name))
            .first()
        )

    def get_system_types(self, db: Session) -> List[InjuryType]:
        """
        Get all system-defined injury types.

        Returns:
            List of system injury types
        """
        return (
            db.query(self.model)
            .filter(self.model.is_system == True)
            .order_by(self.model.name)
            .all()
        )

    def get_user_types(self, db: Session) -> List[InjuryType]:
        """
        Get all user-created injury types.

        Returns:
            List of user-created injury types
        """
        return (
            db.query(self.model)
            .filter(self.model.is_system == False)
            .order_by(self.model.name)
            .all()
        )

    def is_deletable(self, db: Session, *, injury_type_id: int) -> bool:
        """
        Check if an injury type can be deleted.
        System types cannot be deleted.

        Args:
            db: Database session
            injury_type_id: ID of the injury type

        Returns:
            True if the type can be deleted, False otherwise
        """
        injury_type = self.get(db, id=injury_type_id)
        if injury_type is None:
            return False
        return not injury_type.is_system


# Create the CRUD instance
injury_type = CRUDInjuryType(InjuryType)
