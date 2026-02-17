import pytest
from fastapi import status
from app.models.models import FamilyCondition

def test_family_condition_full_lifecycle(authenticated_client, db_session, test_patient):
    fm_res = authenticated_client.post(
        "/api/v1/family-members/",
        json={"name": "Lifecycle Test Relative", "relationship": "brother", "patient_id": test_patient.id}
    )
    assert fm_res.status_code == 200
    fm_id = fm_res.json()["id"]

    cond_data = {
        "condition_name": "Test Condition",
        "status": "active",
        "icd10_code": "E11.9",
        "severity": "mild",
        "condition_type": "diabetes"
    }
    create_res = authenticated_client.post(f"/api/v1/family-members/{fm_id}/conditions", json=cond_data)
    assert create_res.status_code == 200
    cond_id = create_res.json()["id"]
    assert create_res.json()["icd10_code"] == "E11.9"
    assert create_res.json()["status"] == "active"

    update_data = {
        "condition_name": "Updated Condition",
        "status": "resolved",
        "icd10_code": "Z00.0"
    }
    update_res = authenticated_client.put(
        f"/api/v1/family-members/{fm_id}/conditions/{cond_id}",
        json=update_data
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "resolved"
    assert update_res.json()["icd10_code"] == "Z00.0"
    
    db_condition = db_session.query(FamilyCondition).filter(FamilyCondition.id == cond_id).first()
    assert db_condition.status == "resolved"
    assert db_condition.icd10_code == "Z00.0"

    delete_res = authenticated_client.delete(f"/api/v1/family-members/{fm_id}/conditions/{cond_id}")
    assert delete_res.status_code == 200
    
    db_deleted = db_session.query(FamilyCondition).filter(FamilyCondition.id == cond_id).first()
    assert db_deleted is None
