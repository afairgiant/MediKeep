"""CRUDBase logs which records and fields changed, never their values."""

import logging

from app.crud.medication import medication as medication_crud
from app.schemas.medication import MedicationCreate, MedicationUpdate
from tests.utils.log_output import persisted_text

SECRET = "SECRET-PATIENT-NOTE"


def _create(db_session, patient_id, name):
    return medication_crud.create(
        db_session,
        obj_in=MedicationCreate(
            medication_name=name, status="active", patient_id=patient_id
        ),
    )


def test_update_logs_field_names_not_values(db_session, test_patient, caplog):
    med = _create(db_session, test_patient.id, "Before")

    with caplog.at_level(logging.DEBUG, logger="medical_records.app"):
        medication_crud.update(
            db_session,
            db_obj=med,
            obj_in=MedicationUpdate(medication_name=SECRET, notes=SECRET),
        )

    [record] = [r for r in caplog.records if hasattr(r, "updated_fields")]
    assert {"medication_name", "notes"} <= set(record.updated_fields)
    assert SECRET not in persisted_text(caplog)


def test_delete_does_not_log_field_values(db_session, test_patient, caplog):
    med = _create(db_session, test_patient.id, SECRET)

    with caplog.at_level(logging.DEBUG, logger="medical_records.app"):
        medication_crud.delete(db_session, id=med.id)

    assert any("Successfully deleted" in r.getMessage() for r in caplog.records)
    assert SECRET not in persisted_text(caplog)
