from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import Practice as PracticeModel
from app.models.models import Practitioner as PractitionerModel
from app.schemas.practice import PracticeCreate, PracticeUpdate


class CRUDPractice(CRUDBase[PracticeModel, PracticeCreate, PracticeUpdate]):
    """
    Practice-specific CRUD operations.

    Practices are independent entities representing medical clinics or groups
    that practitioners belong to.
    """

    def get_by_name(self, db: Session, *, name: str) -> Optional[PracticeModel]:
        """Retrieve a practice by exact name match."""
        practices = self.query(
            db=db,
            filters={"name": name},
            limit=1,
        )
        return practices[0] if practices else None

    def search_by_name(
        self, db: Session, *, name: str, skip: int = 0, limit: int = 20
    ) -> List[PracticeModel]:
        """Search practices by partial name match."""
        return self.query(
            db=db,
            search={"field": "name", "term": name},
            skip=skip,
            limit=limit,
        )

    def is_name_taken(
        self, db: Session, *, name: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Check if a practice name is already taken."""
        practices = self.query(
            db=db,
            filters={"name": name},
            limit=1,
        )

        if not practices:
            return False

        if exclude_id and practices[0].id == exclude_id:
            return False

        return True

    def create_if_not_exists(
        self, db: Session, *, practice_data: PracticeCreate
    ) -> PracticeModel:
        """Create a practice only if one with the same name doesn't exist."""
        existing = self.get_by_name(db, name=practice_data.name)
        if existing:
            return existing
        return self.create(db, obj_in=practice_data)

    def get_with_practitioners(
        self, db: Session, practice_id: int
    ) -> Optional[PracticeModel]:
        """Retrieve a practice with all associated practitioners loaded."""
        return super().get_with_relations(
            db=db, record_id=practice_id, relations=["practitioners"]
        )

    def get_all_practices_summary(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[PracticeModel]:
        """Get all practices (lightweight, for dropdowns)."""
        return self.get_multi(db, skip=skip, limit=limit)

    def get_practitioner_count(self, db: Session, practice_id: int) -> int:
        """Count practitioners belonging to a practice."""
        return (
            db.query(func.count(PractitionerModel.id))
            .filter(PractitionerModel.practice_id == practice_id)
            .scalar()
            or 0
        )


# Create the practice CRUD instance
practice = CRUDPractice(PracticeModel)
