"""Record-side routes for lab result links on medications and procedures.

A link joins a lab result to a medication or procedure of the same patient. The
lab result side owns creating the rows (``/lab-results/{id}/medications``); these
routes let the medication or procedure list, add, edit and remove the same links:

- ``/medications/{id}/lab-results``
- ``/procedures/{id}/lab-results``
- ``/conditions/{id}/lab-results``
"""

from dataclasses import dataclass
from typing import Any, Callable, List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import handle_not_found, verify_patient_ownership
from app.core.http.error_handling import (
    BusinessLogicException,
    handle_database_errors,
)
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.crud.lab_result import (
    lab_result,
    lab_result_condition,
    lab_result_medication,
    lab_result_procedure,
)
from app.models.models import Condition, Medication, Procedure, User
from app.schemas.lab_result import (
    LabResultConditionCreate,
    LabResultConditionUpdate,
    LabResultMedicationCreate,
    LabResultMedicationUpdate,
    LabResultProcedureCreate,
    LabResultProcedureUpdate,
    RecordLabResultLinkCreate,
    RecordLabResultLinkResponse,
    RecordLabResultLinkUpdate,
)

logger = get_logger(__name__, "app")


@dataclass(frozen=True)
class RecordLabResultLinkConfig:
    """Describes one record type that lab results can be linked to."""

    label: str  # Human-readable singular name for messages
    model: type  # The medication, procedure or condition model
    crud: Any  # The junction CRUD (lab_result_medication, ...)
    fk: str  # Junction column naming the record, e.g. "medication_id"
    create_schema: type
    update_schema: type
    # (db, record_id) -> (link, lab result) rows, joined in one query
    details: Callable[[Session, int], List]
    # Whether the link has a purpose (conditions and procedures; not medications)
    supports_purpose: bool = False


RECORD_LAB_RESULT_LINK_CONFIGS = {
    "medications": RecordLabResultLinkConfig(
        "Medication",
        Medication,
        lab_result_medication,
        "medication_id",
        LabResultMedicationCreate,
        LabResultMedicationUpdate,
        lambda db, record_id: lab_result_medication.get_by_medication_with_details(
            db, medication_id=record_id
        ),
    ),
    "procedures": RecordLabResultLinkConfig(
        "Procedure",
        Procedure,
        lab_result_procedure,
        "procedure_id",
        LabResultProcedureCreate,
        LabResultProcedureUpdate,
        lambda db, record_id: lab_result_procedure.get_by_procedure_with_details(
            db, procedure_id=record_id
        ),
        supports_purpose=True,
    ),
    "conditions": RecordLabResultLinkConfig(
        "Condition",
        Condition,
        lab_result_condition,
        "condition_id",
        LabResultConditionCreate,
        LabResultConditionUpdate,
        lambda db, record_id: lab_result_condition.get_by_condition_with_details(
            db, condition_id=record_id
        ),
        supports_purpose=True,
    ),
}


def _get_record(
    db, request, config, record_id, current_user_patient_id, current_user, permission
):
    record = db.get(config.model, record_id)
    handle_not_found(record, config.label, request)
    verify_patient_ownership(
        record,
        current_user_patient_id,
        config.label.lower(),
        db=db,
        current_user=current_user,
        permission=permission,
    )
    return record


def _require_purpose_support(request, config, purpose):
    """A purpose is only accepted by the links that have one."""
    if purpose is not None and not config.supports_purpose:
        raise BusinessLogicException(
            message=f"{config.label} lab result links have no purpose",
            request=request,
        )


def _get_link(db, request, config, relationship_id, record_id):
    """Fetch a link and confirm it belongs to the record in the path."""
    link = config.crud.get(db, id=relationship_id)
    handle_not_found(link, f"{config.label} lab result link", request)
    if getattr(link, config.fk) != record_id:
        raise BusinessLogicException(
            message=f"Relationship does not belong to this {config.label.lower()}",
            request=request,
        )
    return link


def _serialize(config, link, db_lab_result):
    return {
        "id": link.id,
        "lab_result_id": link.lab_result_id,
        config.fk: getattr(link, config.fk),
        "purpose": getattr(link, "purpose", None),
        "relevance_note": link.relevance_note,
        "created_at": link.created_at,
        "updated_at": link.updated_at,
        "lab_result": db_lab_result,
    }


def _log(request, user, operation, config, link_id, record):
    log_data_access(
        logger,
        request,
        user.id,
        operation,
        f"{config.label}LabResultLink",
        record_id=link_id,
        patient_id=record.patient_id,
    )


def register_record_lab_result_routes(router: APIRouter, config_key: str) -> None:
    """Add the ``/{id}/lab-results`` routes to a medication or procedure router."""
    config = RECORD_LAB_RESULT_LINK_CONFIGS[config_key]
    lower = config.label.lower()
    base = "/{record_id}/lab-results"

    def list_links(
        request: Request,
        record_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            record = _get_record(
                db,
                request,
                config,
                record_id,
                current_user_patient_id,
                current_user,
                "view",
            )
            rows = config.details(db, record_id)
            # A link to another patient's lab result is never shown
            result = [
                _serialize(config, link, lab)
                for link, lab in rows
                if lab.patient_id == record.patient_id
            ]
            _log(request, current_user, "read", config, record_id, record)
            return result

    def create_link(
        request: Request,
        record_id: int,
        link_in: RecordLabResultLinkCreate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            record = _get_record(
                db,
                request,
                config,
                record_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            _require_purpose_support(request, config, link_in.purpose)
            db_lab_result = lab_result.get(db, id=link_in.lab_result_id)
            handle_not_found(db_lab_result, "Lab result", request)
            verify_patient_ownership(
                db_lab_result,
                current_user_patient_id,
                "lab_result",
                db=db,
                current_user=current_user,
                permission="view",
            )
            if db_lab_result.patient_id != record.patient_id:
                raise BusinessLogicException(
                    message=(
                        "Cannot link a lab result that doesn't belong to "
                        f"the same patient as the {lower}"
                    ),
                    request=request,
                )
            existing = (
                db.query(config.crud.model)
                .filter(
                    config.crud.model.lab_result_id == db_lab_result.id,
                    getattr(config.crud.model, config.fk) == record_id,
                )
                .first()
            )
            if existing:
                raise BusinessLogicException(
                    message=f"This lab result is already linked to this {lower}",
                    request=request,
                )
            link = config.crud.create(
                db,
                obj_in=config.create_schema(
                    lab_result_id=db_lab_result.id,
                    relevance_note=link_in.relevance_note,
                    **({"purpose": link_in.purpose} if config.supports_purpose else {}),
                    **{config.fk: record_id},
                ),
            )
            _log(request, current_user, "create", config, link.id, record)
            return _serialize(config, link, db_lab_result)

    def update_link(
        request: Request,
        record_id: int,
        relationship_id: int,
        link_in: RecordLabResultLinkUpdate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            record = _get_record(
                db,
                request,
                config,
                record_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            # Only the fields the request sent change; a field left out stays as it is
            fields = link_in.model_dump(exclude_unset=True)
            _require_purpose_support(request, config, fields.get("purpose"))
            link = _get_link(db, request, config, relationship_id, record_id)
            updated = config.crud.update(
                db,
                db_obj=link,
                obj_in=config.update_schema(**fields),
            )
            _log(request, current_user, "update", config, updated.id, record)
            return _serialize(
                config, updated, lab_result.get(db, id=updated.lab_result_id)
            )

    def delete_link(
        request: Request,
        record_id: int,
        relationship_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            record = _get_record(
                db,
                request,
                config,
                record_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            _get_link(db, request, config, relationship_id, record_id)
            config.crud.delete(db, id=relationship_id)
            _log(request, current_user, "delete", config, relationship_id, record)
            return {"message": f"{config.label} lab result link deleted successfully"}

    router.add_api_route(
        base,
        list_links,
        methods=["GET"],
        response_model=List[RecordLabResultLinkResponse],
    )
    router.add_api_route(
        base,
        create_link,
        methods=["POST"],
        response_model=RecordLabResultLinkResponse,
    )
    router.add_api_route(
        f"{base}/{{relationship_id}}",
        update_link,
        methods=["PUT"],
        response_model=RecordLabResultLinkResponse,
    )
    router.add_api_route(f"{base}/{{relationship_id}}", delete_link, methods=["DELETE"])
