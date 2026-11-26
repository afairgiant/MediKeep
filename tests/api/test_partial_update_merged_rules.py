"""Partial updates are checked against the stored row, not only the request."""

from datetime import date, timedelta
from typing import Any, NamedTuple

import pytest

from app.models.associations import TreatmentMedication
from app.models.clinical import (
    Condition,
    Encounter,
    Immunization,
    Medication,
    Symptom,
    SymptomOccurrence,
)
from app.models.family import FamilyMember
from app.models.labs import LabResult
from app.models.patient import Insurance
from app.models.procedures import MedicalEquipment, Procedure, Treatment

FUTURE = (date.today() + timedelta(days=30)).isoformat()

TREATMENT = {
    "treatment_name": "Physical Therapy",
    "treatment_type": "Rehabilitation",
    "start_date": "2024-06-01",
    "status": "active",
}
PLANNED_TREATMENT = {**TREATMENT, "start_date": FUTURE, "status": "planned"}
SCHEDULED_PROCEDURE = {
    "procedure_name": "Knee Arthroscopy",
    "date": FUTURE,
    "status": "scheduled",
}
LAB_ORDERED = {"test_name": "Complete Blood Count", "ordered_date": "2024-06-01"}
LAB_RANGE = {"test_name": "Glucose", "ref_range_min": 70, "ref_range_max": 100}
EQUIPMENT = {
    "equipment_name": "CPAP Machine",
    "equipment_type": "cpap",
    "last_service_date": "2024-06-01",
}
FAMILY_MEMBER = {"name": "Pat Doe", "relationship": "father", "birth_year": 1950}
INSURANCE = {
    "insurance_type": "medical",
    "company_name": "Acme Health",
    "member_name": "Alex Doe",
    "member_id": "M-100",
    "effective_date": "2024-06-01",
}
SYMPTOM = {"symptom_name": "Headache", "first_occurrence_date": "2024-06-01"}


class Case(NamedTuple):
    path: str
    model: Any
    body: dict
    update: dict
    message: str
    unrelated: dict = {"notes": "Updated"}


CASES = {
    "treatment-end-before-start": Case(
        "/api/v1/treatments/",
        Treatment,
        TREATMENT,
        {"end_date": "2024-01-01"},
        "End date cannot be before start date",
    ),
    "treatment-status-with-future-start": Case(
        "/api/v1/treatments/",
        Treatment,
        PLANNED_TREATMENT,
        {"status": "active"},
        "Start date cannot be in the future for active treatments",
    ),
    "lab-completed-before-ordered": Case(
        "/api/v1/lab-results/",
        LabResult,
        LAB_ORDERED,
        {"completed_date": "2024-01-01"},
        "Completed date cannot be before ordered date",
    ),
    "lab-ref-range-inverted": Case(
        "/api/v1/lab-results/",
        LabResult,
        LAB_RANGE,
        {"ref_range_max": 50},
        "Reference range maximum must be greater than minimum",
    ),
    "medication-period-end-before-start": Case(
        "/api/v1/medications/",
        Medication,
        {"medication_name": "Aspirin", "effective_period_start": "2024-06-01"},
        {"effective_period_end": "2024-01-01"},
        "End date must be after start date",
    ),
    "equipment-next-service-before-last": Case(
        "/api/v1/medical-equipment/",
        MedicalEquipment,
        EQUIPMENT,
        {"next_service_date": "2024-01-01"},
        "Next service date cannot be before last service date",
    ),
    "procedure-status-with-future-date": Case(
        "/api/v1/procedures/",
        Procedure,
        SCHEDULED_PROCEDURE,
        {"status": "completed"},
        "Procedure date cannot be in the future for completed procedures",
    ),
    "condition-end-before-onset": Case(
        "/api/v1/conditions/",
        Condition,
        {"diagnosis": "Asthma", "status": "active", "onset_date": "2024-06-01"},
        {"end_date": "2024-01-01"},
        "End date cannot be before onset date",
    ),
    "immunization-expiration-before-administered": Case(
        "/api/v1/immunizations/",
        Immunization,
        {"vaccine_name": "Influenza", "date_administered": "2024-06-01"},
        {"expiration_date": "2024-01-01"},
        "Expiration date cannot be before administration date",
    ),
    "family-member-death-before-birth": Case(
        "/api/v1/family-members/",
        FamilyMember,
        FAMILY_MEMBER,
        {"death_year": 1940, "is_deceased": True},
        "Death year cannot be before birth year",
    ),
    "family-member-death-year-not-deceased": Case(
        "/api/v1/family-members/",
        FamilyMember,
        FAMILY_MEMBER,
        {"death_year": 2010},
        "If death year is provided, family member must be marked as deceased",
    ),
    "insurance-expiration-before-effective": Case(
        "/api/v1/insurances/",
        Insurance,
        INSURANCE,
        {"expiration_date": "2024-01-01"},
        "Expiration date must be after effective date",
    ),
    "symptom-resolved-before-first-occurrence": Case(
        "/api/v1/symptoms/",
        Symptom,
        SYMPTOM,
        {"resolved_date": "2024-01-01"},
        "Resolved date cannot be before first occurrence date",
        {"general_notes": "Updated"},
    ),
}


def _create(client, headers, path, body, patient_id=None):
    payload = body if patient_id is None else {**body, "patient_id": patient_id}
    response = client.post(path, json=payload, headers=headers)
    assert response.status_code in (200, 201), response.text
    return response.json()


def _put(client, headers, path, record_id, body):
    return client.put(f"{path}{record_id}", json=body, headers=headers)


@pytest.mark.parametrize("case", CASES.values(), ids=CASES)
def test_one_sided_update_breaking_a_rule_is_rejected(
    client, db_session, authenticated_headers, patient_id, case
):
    record = _create(client, authenticated_headers, case.path, case.body, patient_id)
    row = db_session.get(case.model, record["id"])
    before = {field: getattr(row, field) for field in case.update}

    response = _put(client, authenticated_headers, case.path, record["id"], case.update)

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == [case.message]
    db_session.expire_all()
    row = db_session.get(case.model, record["id"])
    assert {field: getattr(row, field) for field in case.update} == before


@pytest.mark.parametrize("case", CASES.values(), ids=CASES)
def test_unrelated_update_saves(client, authenticated_headers, patient_id, case):
    record = _create(client, authenticated_headers, case.path, case.body, patient_id)

    response = _put(
        client, authenticated_headers, case.path, record["id"], case.unrelated
    )

    assert response.status_code == 200, response.text


@pytest.mark.parametrize(
    "path, body, update",
    [
        ("/api/v1/treatments/", TREATMENT, {"end_date": "2024-09-01"}),
        (
            "/api/v1/treatments/",
            TREATMENT,
            {"start_date": None, "end_date": "2024-01-01"},
        ),
        ("/api/v1/lab-results/", LAB_RANGE, {"ref_range_min": 20, "ref_range_max": 50}),
        ("/api/v1/procedures/", SCHEDULED_PROCEDURE, {"status": "postponed"}),
        ("/api/v1/procedures/", SCHEDULED_PROCEDURE, {"status": "cancelled"}),
        ("/api/v1/treatments/", PLANNED_TREATMENT, {"status": "cancelled"}),
        ("/api/v1/insurances/", INSURANCE, {"expiration_date": "2025-06-01"}),
    ],
    ids=[
        "valid-one-side",
        "cleared-other-side",
        "both-sides-valid",
        "allowed-status",
        "cancel-future-procedure",
        "cancel-future-treatment",
        "valid-expiration",
    ],
)
def test_update_that_keeps_rules_saves(
    client, authenticated_headers, patient_id, path, body, update
):
    record = _create(client, authenticated_headers, path, body, patient_id)

    response = _put(client, authenticated_headers, path, record["id"], update)

    assert response.status_code == 200, response.text


@pytest.mark.parametrize(
    "path, model, body, broken, resent",
    [
        (
            "/api/v1/lab-results/",
            LabResult,
            LAB_ORDERED,
            {"completed_date": date(2024, 1, 1)},
            {"ordered_date": "2024-06-01", "completed_date": "2024-01-01"},
        ),
        (
            "/api/v1/medical-equipment/",
            MedicalEquipment,
            EQUIPMENT,
            {"next_service_date": date(2024, 1, 1)},
            {"last_service_date": "2024-06-01", "next_service_date": "2024-01-01"},
        ),
        (
            "/api/v1/treatments/",
            Treatment,
            TREATMENT,
            {"end_date": date(2024, 1, 1)},
            {"start_date": "2024-06-01", "end_date": "2024-01-01", "status": "active"},
        ),
    ],
    ids=["lab-result", "equipment", "treatment"],
)
def test_stored_row_breaking_a_rule_takes_edits_that_leave_it_unchanged(
    client,
    db_session,
    authenticated_headers,
    patient_id,
    path,
    model,
    body,
    broken,
    resent,
):
    record = _create(client, authenticated_headers, path, body, patient_id)
    row = db_session.get(model, record["id"])
    for field, value in broken.items():
        setattr(row, field, value)
    db_session.commit()

    notes_only = _put(client, authenticated_headers, path, record["id"], {"notes": "A"})
    full_form = _put(
        client, authenticated_headers, path, record["id"], {**resent, "notes": "B"}
    )

    assert notes_only.status_code == 200, notes_only.text
    assert full_form.status_code == 200, full_form.text


@pytest.mark.parametrize(
    "path, body",
    [
        ("/api/v1/procedures/", {**SCHEDULED_PROCEDURE, "status": 1}),
        ("/api/v1/treatments/", {**TREATMENT, "start_date": ["2024-06-01"]}),
    ],
    ids=["status-not-a-string", "date-not-a-date"],
)
def test_wrong_value_types_are_validation_errors(
    client, authenticated_headers, patient_id, path, body
):
    response = client.post(
        path, json={**body, "patient_id": patient_id}, headers=authenticated_headers
    )

    assert response.status_code == 422, response.text


def test_symptom_occurrence_update_is_checked_against_stored_row(
    client, db_session, authenticated_headers, patient_id
):
    symptom = _create(
        client, authenticated_headers, "/api/v1/symptoms/", SYMPTOM, patient_id
    )
    path = f"/api/v1/symptoms/{symptom['id']}/occurrences/"
    occurrence = _create(
        client,
        authenticated_headers,
        path.rstrip("/"),
        {"occurrence_date": "2024-06-01", "severity": "mild"},
    )

    rejected = _put(
        client,
        authenticated_headers,
        path,
        occurrence["id"],
        {"resolved_date": "2024-01-01"},
    )
    saved = _put(
        client,
        authenticated_headers,
        path,
        occurrence["id"],
        {"resolved_date": "2024-07-01"},
    )

    assert rejected.status_code == 422, rejected.text
    assert rejected.json()["detail"] == ["Resolved date must be after occurrence date"]
    assert saved.status_code == 200, saved.text
    db_session.expire_all()
    stored = db_session.get(SymptomOccurrence, occurrence["id"])
    assert stored.resolved_date == date(2024, 7, 1)


def test_treatment_medication_update_is_checked_against_stored_row(
    client, db_session, authenticated_headers, patient_id
):
    treatment = _create(
        client, authenticated_headers, "/api/v1/treatments/", TREATMENT, patient_id
    )
    medication = _create(
        client,
        authenticated_headers,
        "/api/v1/medications/",
        {"medication_name": "Aspirin"},
        patient_id,
    )
    path = f"/api/v1/treatments/{treatment['id']}/medications/"
    link = _create(
        client,
        authenticated_headers,
        path.rstrip("/"),
        {"medication_id": medication["id"], "specific_start_date": "2024-06-01"},
    )

    rejected = _put(
        client,
        authenticated_headers,
        path,
        link["id"],
        {"specific_end_date": "2024-01-01"},
    )

    assert rejected.status_code == 422, rejected.text
    assert rejected.json()["detail"] == [
        "Specific end date cannot be before specific start date"
    ]
    db_session.expire_all()
    assert db_session.get(TreatmentMedication, link["id"]).specific_end_date is None


def test_symptom_create_checks_resolved_against_first_occurrence(
    client, authenticated_headers, patient_id
):
    response = client.post(
        "/api/v1/symptoms/",
        json={**SYMPTOM, "resolved_date": "2024-01-01", "patient_id": patient_id},
        headers=authenticated_headers,
    )

    assert response.status_code == 422, response.text


def test_encounter_reminder_rule_names_the_rule_for_the_form(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/encounters/"
    record = _create(
        client,
        authenticated_headers,
        path,
        {"reason": "Checkup", "date": "2024-01-01"},
        patient_id,
    )

    rejected = _put(
        client, authenticated_headers, path, record["id"], {"reminder_offsets": [60]}
    )
    db_session.get(Encounter, record["id"]).reminder_offsets = [60]
    db_session.commit()
    unrelated = _put(client, authenticated_headers, path, record["id"], {"notes": "A"})

    assert rejected.status_code == 422, rejected.text
    assert rejected.json()["detail"] == [
        "Reminders in hours or minutes need a visit start time"
    ]
    assert unrelated.status_code == 200, unrelated.text
