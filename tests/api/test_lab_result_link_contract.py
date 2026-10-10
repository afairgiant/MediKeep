"""
Contract tests: the nested record each lab result link list returns.

The link cards (frontend/src/constants/labResultRecordLinks.ts) read these fields to name
a link, show its status and date, and label its purpose. A response model that silently
drops one shows up as "#<id>" in the card, and the frontend tests cannot notice, because
their mocks carry the field. So the keys are asserted here, against the real responses.
"""

from datetime import date, timedelta

import pytest

BODIES = {
    "conditions": (
        "/api/v1/conditions/",
        {"diagnosis": "Hypertension", "status": "active", "severity": "mild"},
    ),
    "medications": (
        "/api/v1/medications/",
        {"medication_name": "Atorvastatin", "dosage": "20mg", "status": "active"},
    ),
    "procedures": (
        "/api/v1/procedures/",
        {
            "procedure_name": "Appendectomy",
            "date": str(date.today() - timedelta(days=3)),
            "status": "completed",
        },
    ),
    "treatments": (
        "/api/v1/treatments/",
        {
            "treatment_name": "Insulin therapy",
            "treatment_type": "Medication",
            "status": "active",
            "start_date": str(date.today() - timedelta(days=30)),
        },
    ),
}
FK = {
    "conditions": "condition_id",
    "medications": "medication_id",
    "procedures": "procedure_id",
    "treatments": "treatment_id",
}
NESTED = {
    "conditions": ("condition", {"diagnosis": "Hypertension", "status": "active"}),
    "medications": (
        "medication",
        {"medication_name": "Atorvastatin", "dosage": "20mg", "status": "active"},
    ),
    "procedures": (
        "procedure",
        {"procedure_name": "Appendectomy", "status": "completed"},
    ),
    "treatments": (
        "treatment",
        {"treatment_name": "Insulin therapy", "status": "active"},
    ),
}


@pytest.fixture
def linked(client, user_with_patient, authenticated_headers):
    """A lab result linked to one record of every type, through the lab result side."""
    patient_id = user_with_patient["patient"].id
    lab = client.post(
        "/api/v1/lab-results/",
        json={
            "test_name": "Liver Panel",
            "test_category": "chemistry",
            "status": "completed",
            "patient_id": patient_id,
        },
        headers=authenticated_headers,
    )
    assert lab.status_code == 201
    lab_id = lab.json()["id"]
    for kind, (url, body) in BODIES.items():
        record = client.post(
            url,
            json={**body, "patient_id": patient_id},
            headers=authenticated_headers,
        )
        assert record.status_code in (200, 201), record.text
        link_body = {FK[kind]: record.json()["id"]}
        if kind != "treatments":
            link_body["lab_result_id"] = lab_id
        if kind in ("conditions", "procedures", "treatments"):
            link_body["purpose"] = "monitoring"
        link = client.post(
            f"/api/v1/lab-results/{lab_id}/{kind}",
            json=link_body,
            headers=authenticated_headers,
        )
        assert link.status_code in (200, 201), link.text
    return lab_id


@pytest.mark.parametrize("kind", list(BODIES))
def test_lab_result_side_list_names_the_linked_record(
    kind, client, authenticated_headers, linked
):
    rows = client.get(
        f"/api/v1/lab-results/{linked}/{kind}", headers=authenticated_headers
    ).json()
    assert len(rows) == 1
    nested_key, expected = NESTED[kind]
    nested = rows[0][nested_key]
    for field, value in expected.items():
        assert nested[field] == value, f"{nested_key}.{field}"
    assert rows[0][FK[kind]] == nested["id"]


@pytest.mark.parametrize("kind", ["conditions", "procedures", "treatments"])
def test_lab_result_side_list_carries_the_purpose(
    kind, client, authenticated_headers, linked
):
    rows = client.get(
        f"/api/v1/lab-results/{linked}/{kind}", headers=authenticated_headers
    ).json()
    assert rows[0]["purpose"] == "monitoring"


def test_procedure_rows_carry_the_date_the_card_shows(
    client, authenticated_headers, linked
):
    row = client.get(
        f"/api/v1/lab-results/{linked}/procedures", headers=authenticated_headers
    ).json()[0]
    assert row["procedure"]["date"] == str(date.today() - timedelta(days=3))


def test_treatment_rows_carry_the_expected_frequency_field(
    client, authenticated_headers, linked
):
    row = client.get(
        f"/api/v1/lab-results/{linked}/treatments", headers=authenticated_headers
    ).json()[0]
    assert "expected_frequency" in row
