"""CRUD operations for Imaging Studies."""

from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, load_only, selectinload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.imaging import ImagingInstance, ImagingSeries, ImagingStudy
from app.schemas.imaging_study import ImagingStudyUpdate


class CRUDImagingStudy(
    CRUDBase[ImagingStudy, ImagingStudyUpdate, ImagingStudyUpdate],
    TagFilterMixin,
):
    """Imaging study CRUD; studies are created by the import service, not here."""

    def get_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        tags: Optional[List[str]] = None,
        tag_match_all: bool = False,
    ) -> List[ImagingStudy]:
        """Studies for a patient, newest study date first (undated last)."""
        query = db.query(self.model).filter(self.model.patient_id == patient_id)
        query = self._apply_tag_filter(query, tags=tags, tag_match_all=tag_match_all)
        return (
            query.order_by(
                self.model.study_date.desc().nulls_last(), self.model.id.desc()
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_series_with_instances(
        self, db: Session, *, study_id: int
    ) -> List[ImagingSeries]:
        """All series of a study with the viewer's instance fields loaded, in series order."""
        return (
            db.query(ImagingSeries)
            .options(
                selectinload(ImagingSeries.instances).options(
                    load_only(
                        ImagingInstance.id,
                        ImagingInstance.series_id,
                        ImagingInstance.sop_instance_uid,
                        ImagingInstance.instance_number,
                        ImagingInstance.rows,
                        ImagingInstance.cols,
                        ImagingInstance.number_of_frames,
                    )
                )
            )
            .filter(ImagingSeries.study_id == study_id)
            .order_by(ImagingSeries.series_number.asc().nulls_last(), ImagingSeries.id)
            .all()
        )

    def get_instance_with_patient(
        self, db: Session, *, study_id: int, instance_id: int
    ) -> Optional[Tuple[ImagingInstance, int]]:
        """The instance and its study's patient_id, only when it belongs to the study."""
        return (
            db.query(ImagingInstance, ImagingStudy.patient_id)
            .join(ImagingSeries, ImagingInstance.series_id == ImagingSeries.id)
            .join(ImagingStudy, ImagingSeries.study_id == ImagingStudy.id)
            .filter(
                ImagingInstance.id == instance_id,
                ImagingStudy.id == study_id,
            )
            .first()
        )


imaging_study = CRUDImagingStudy(ImagingStudy)
