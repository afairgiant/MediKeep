"""Shared route factory for note-only encounter links.

A link joins an encounter (visit) to another record of the same patient and can be
created, listed, updated and deleted from either side:

- visit side:  ``/encounters/{id}/{type}``
- record side: ``/{type}/{id}/encounters``

Treatments and lab results keep their own record-side routes (they carry extra
fields), so ``reverse`` is False for treatments and lab results are not listed here.
"""

from dataclasses import dataclass
from typing import Any, List

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
from app.crud.encounter import (
    CRUDEncounterLink,
    encounter,
    encounter_condition,
    encounter_injury,
    encounter_medication,
    encounter_procedure,
    encounter_symptom,
    encounter_treatment,
)
from app.models.models import User
from app.schemas.encounter import (
    EncounterLinkBulkCreate,
    EncounterLinkCreate,
    EncounterLinkResponse,
    EncounterLinkUpdate,
    RecordEncounterLinkBulkCreate,
    RecordEncounterLinkCreate,
)

logger = get_logger(__name__, "app")


@dataclass(frozen=True)
class EncounterLinkConfig:
    """Describes one linkable record type."""

    path: str  # URL segment, e.g. "procedures"
    label: str  # Human-readable singular name for messages
    crud: CRUDEncounterLink
    name_attr: str  # Display name column on the linked model
    date_attr: str  # Display date column on the linked model
    status_attr: str = "status"
    reverse: bool = True  # False when the record router already owns /encounters


ENCOUNTER_LINK_CONFIGS = {
    "procedures": EncounterLinkConfig(
        "procedures", "Procedure", encounter_procedure, "procedure_name", "date"
    ),
    "symptoms": EncounterLinkConfig(
        "symptoms",
        "Symptom",
        encounter_symptom,
        "symptom_name",
        "first_occurrence_date",
    ),
    "injuries": EncounterLinkConfig(
        "injuries", "Injury", encounter_injury, "injury_name", "date_of_injury"
    ),
    "medications": EncounterLinkConfig(
        "medications",
        "Medication",
        encounter_medication,
        "medication_name",
        "effective_period_start",
    ),
    "conditions": EncounterLinkConfig(
        "conditions", "Condition", encounter_condition, "diagnosis", "onset_date"
    ),
    "treatments": EncounterLinkConfig(
        "treatments",
        "Treatment",
        encounter_treatment,
        "treatment_name",
        "start_date",
        reverse=False,
    ),
}


def _serialize(config: EncounterLinkConfig, link, entity, db_encounter) -> dict:
    """Build the response dict from a link row, its record and its encounter."""
    return {
        "id": link.id,
        "encounter_id": link.encounter_id,
        "entity_id": getattr(link, config.crud.entity_fk),
        "relevance_note": link.relevance_note,
        "created_at": link.created_at,
        "updated_at": link.updated_at,
        "entity_name": getattr(entity, config.name_attr, None),
        "entity_date": getattr(entity, config.date_attr, None),
        "entity_status": getattr(entity, config.status_attr, None),
        "encounter_reason": db_encounter.reason,
        "encounter_date": db_encounter.date,
    }


def _get_encounter(
    db, request, encounter_id, current_user_patient_id, current_user, permission
):
    db_encounter = encounter.get(db, id=encounter_id)
    handle_not_found(db_encounter, "Encounter", request)
    verify_patient_ownership(
        db_encounter,
        current_user_patient_id,
        "encounter",
        db=db,
        current_user=current_user,
        permission=permission,
    )
    return db_encounter


def _get_entity(
    db, request, config, entity_id, current_user_patient_id, current_user, permission
):
    entity = db.get(config.crud.entity_model, entity_id)
    handle_not_found(entity, config.label, request)
    verify_patient_ownership(
        entity,
        current_user_patient_id,
        config.label.lower(),
        db=db,
        current_user=current_user,
        permission=permission,
    )
    return entity


def _require_same_patient(request, config, entity, db_encounter):
    if entity.patient_id != db_encounter.patient_id:
        raise BusinessLogicException(
            message=(
                f"Cannot link {config.label.lower()} that doesn't belong to "
                "the same patient"
            ),
            request=request,
        )


def _log(request, user, operation, config, link_id, db_encounter):
    log_data_access(
        logger,
        request,
        user.id,
        operation,
        f"Encounter{config.label}Link",
        record_id=link_id,
        patient_id=db_encounter.patient_id,
    )


def _get_link(
    db, request, config, relationship_id, *, encounter_id=None, entity_id=None
):
    """Fetch a link and confirm it belongs to the encounter/record in the path."""
    link = config.crud.get(db, id=relationship_id)
    handle_not_found(link, f"Encounter {config.label.lower()} link", request)
    if encounter_id is not None and link.encounter_id != encounter_id:
        raise BusinessLogicException(
            message="Relationship does not belong to this encounter", request=request
        )
    if entity_id is not None and getattr(link, config.crud.entity_fk) != entity_id:
        raise BusinessLogicException(
            message=f"Relationship does not belong to this {config.label.lower()}",
            request=request,
        )
    return link


def _create_one(db, request, config, db_encounter, entity, note):
    if config.crud.get_by_encounter_and_entity(
        db, encounter_id=db_encounter.id, entity_id=entity.id
    ):
        raise BusinessLogicException(
            message=f"This {config.label.lower()} is already linked to this encounter",
            request=request,
        )
    return config.crud.create_link(
        db, encounter_id=db_encounter.id, entity_id=entity.id, relevance_note=note
    )


def register_encounter_link_routes(router: APIRouter) -> None:
    """Add the per-encounter (visit side) routes for every configured type."""
    for config in ENCOUNTER_LINK_CONFIGS.values():
        _register_visit_routes(router, config)


def register_record_encounter_routes(router: APIRouter, config_key: str) -> None:
    """Add the ``/{id}/encounters`` (record side) routes to a record's router."""
    config = ENCOUNTER_LINK_CONFIGS[config_key]
    if not config.reverse:
        raise ValueError(f"{config_key} owns its own record-side routes")
    _register_record_routes(router, config)


def _register_visit_routes(router: APIRouter, config: EncounterLinkConfig) -> None:
    base = f"/{{encounter_id}}/{config.path}"
    lower = config.label.lower()

    def list_links(
        request: Request,
        encounter_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            db_encounter = _get_encounter(
                db, request, encounter_id, current_user_patient_id, current_user, "view"
            )
            rows = config.crud.get_by_encounter_with_details(
                db, encounter_id=encounter_id
            )
            return [_serialize(config, link, ent, db_encounter) for link, ent in rows]

    def create_link(
        request: Request,
        encounter_id: int,
        link_in: EncounterLinkCreate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            db_encounter = _get_encounter(
                db, request, encounter_id, current_user_patient_id, current_user, "edit"
            )
            entity = db.get(config.crud.entity_model, link_in.entity_id)
            handle_not_found(entity, config.label, request)
            _require_same_patient(request, config, entity, db_encounter)
            link = _create_one(
                db, request, config, db_encounter, entity, link_in.relevance_note
            )
            _log(request, current_user, "create", config, link.id, db_encounter)
            return _serialize(config, link, entity, db_encounter)

    def bulk_create_links(
        request: Request,
        encounter_id: int,
        bulk_in: EncounterLinkBulkCreate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            db_encounter = _get_encounter(
                db, request, encounter_id, current_user_patient_id, current_user, "edit"
            )
            entities = {}
            for entity_id in bulk_in.entity_ids:
                entity = db.get(config.crud.entity_model, entity_id)
                handle_not_found(entity, config.label, request)
                _require_same_patient(request, config, entity, db_encounter)
                entities[entity_id] = entity
            created = config.crud.create_bulk(
                db,
                encounter_id=encounter_id,
                entity_ids=bulk_in.entity_ids,
                relevance_note=bulk_in.relevance_note,
            )
            for link in created:
                _log(request, current_user, "create", config, link.id, db_encounter)
            return [
                _serialize(
                    config,
                    link,
                    entities[getattr(link, config.crud.entity_fk)],
                    db_encounter,
                )
                for link in created
            ]

    def update_link(
        request: Request,
        encounter_id: int,
        relationship_id: int,
        link_in: EncounterLinkUpdate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            db_encounter = _get_encounter(
                db, request, encounter_id, current_user_patient_id, current_user, "edit"
            )
            link = _get_link(
                db, request, config, relationship_id, encounter_id=encounter_id
            )
            updated = config.crud.update(db, db_obj=link, obj_in=link_in)
            entity = db.get(
                config.crud.entity_model, getattr(updated, config.crud.entity_fk)
            )
            _log(request, current_user, "update", config, updated.id, db_encounter)
            return _serialize(config, updated, entity, db_encounter)

    def delete_link(
        request: Request,
        encounter_id: int,
        relationship_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            db_encounter = _get_encounter(
                db, request, encounter_id, current_user_patient_id, current_user, "edit"
            )
            _get_link(db, request, config, relationship_id, encounter_id=encounter_id)
            config.crud.delete(db, id=relationship_id)
            _log(request, current_user, "delete", config, relationship_id, db_encounter)
            return {"message": f"Encounter {lower} link deleted successfully"}

    response_list = List[EncounterLinkResponse]
    router.add_api_route(
        base, list_links, methods=["GET"], response_model=response_list
    )
    router.add_api_route(
        base, create_link, methods=["POST"], response_model=EncounterLinkResponse
    )
    router.add_api_route(
        f"{base}/bulk",
        bulk_create_links,
        methods=["POST"],
        response_model=response_list,
    )
    router.add_api_route(
        f"{base}/{{relationship_id}}",
        update_link,
        methods=["PUT"],
        response_model=EncounterLinkResponse,
    )
    router.add_api_route(f"{base}/{{relationship_id}}", delete_link, methods=["DELETE"])


def _register_record_routes(router: APIRouter, config: EncounterLinkConfig) -> None:
    base = "/{entity_id}/encounters"
    lower = config.label.lower()

    def list_links(
        request: Request,
        entity_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            entity = _get_entity(
                db,
                request,
                config,
                entity_id,
                current_user_patient_id,
                current_user,
                "view",
            )
            rows = config.crud.get_by_entity_with_details(db, entity_id=entity_id)
            return [_serialize(config, link, entity, enc) for link, enc in rows]

    def _get_same_patient_encounter(db, request, entity, encounter_id):
        db_encounter = encounter.get(db, id=encounter_id)
        handle_not_found(db_encounter, "Encounter", request)
        _require_same_patient(request, config, entity, db_encounter)
        return db_encounter

    def create_link(
        request: Request,
        entity_id: int,
        link_in: RecordEncounterLinkCreate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            entity = _get_entity(
                db,
                request,
                config,
                entity_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            db_encounter = _get_same_patient_encounter(
                db, request, entity, link_in.encounter_id
            )
            link = _create_one(
                db, request, config, db_encounter, entity, link_in.relevance_note
            )
            _log(request, current_user, "create", config, link.id, db_encounter)
            return _serialize(config, link, entity, db_encounter)

    def bulk_create_links(
        request: Request,
        entity_id: int,
        bulk_in: RecordEncounterLinkBulkCreate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            entity = _get_entity(
                db,
                request,
                config,
                entity_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            encounters = {
                encounter_id: _get_same_patient_encounter(
                    db, request, entity, encounter_id
                )
                for encounter_id in bulk_in.encounter_ids
            }
            results = []
            for encounter_id, db_encounter in encounters.items():
                if config.crud.get_by_encounter_and_entity(
                    db, encounter_id=encounter_id, entity_id=entity_id
                ):
                    continue
                link = config.crud.create_link(
                    db,
                    encounter_id=encounter_id,
                    entity_id=entity_id,
                    relevance_note=bulk_in.relevance_note,
                )
                _log(request, current_user, "create", config, link.id, db_encounter)
                results.append(_serialize(config, link, entity, db_encounter))
            return results

    def update_link(
        request: Request,
        entity_id: int,
        relationship_id: int,
        link_in: EncounterLinkUpdate,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            entity = _get_entity(
                db,
                request,
                config,
                entity_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            link = _get_link(db, request, config, relationship_id, entity_id=entity_id)
            updated = config.crud.update(db, db_obj=link, obj_in=link_in)
            db_encounter = encounter.get(db, id=updated.encounter_id)
            _log(request, current_user, "update", config, updated.id, db_encounter)
            return _serialize(config, updated, entity, db_encounter)

    def delete_link(
        request: Request,
        entity_id: int,
        relationship_id: int,
        db: Session = Depends(deps.get_db),
        current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
        current_user: User = Depends(deps.get_current_user),
    ) -> Any:
        with handle_database_errors(request=request):
            _get_entity(
                db,
                request,
                config,
                entity_id,
                current_user_patient_id,
                current_user,
                "edit",
            )
            link = _get_link(db, request, config, relationship_id, entity_id=entity_id)
            db_encounter = encounter.get(db, id=link.encounter_id)
            config.crud.delete(db, id=relationship_id)
            _log(request, current_user, "delete", config, relationship_id, db_encounter)
            return {"message": f"Encounter {lower} link deleted successfully"}

    response_list = List[EncounterLinkResponse]
    router.add_api_route(
        base, list_links, methods=["GET"], response_model=response_list
    )
    router.add_api_route(
        base, create_link, methods=["POST"], response_model=EncounterLinkResponse
    )
    router.add_api_route(
        f"{base}/bulk",
        bulk_create_links,
        methods=["POST"],
        response_model=response_list,
    )
    router.add_api_route(
        f"{base}/{{relationship_id}}",
        update_link,
        methods=["PUT"],
        response_model=EncounterLinkResponse,
    )
    router.add_api_route(f"{base}/{{relationship_id}}", delete_link, methods=["DELETE"])
