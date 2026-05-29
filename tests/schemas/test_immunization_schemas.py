from datetime import date

from app.schemas.immunization import (
    ImmunizationCreate,
    ImmunizationResponse,
    ImmunizationUpdate,
    ImmunizationHistoryItem,
    ImmunizationHistoryResponse,
)


def test_create_accepts_standardized_vaccine_who_code():
    payload = {
        "vaccine_name": "MMR",
        "date_administered": date(2024, 1, 1),
        "patient_id": 1,
        "standardized_vaccine_who_code": "PCV-WHO-1234",
    }
    obj = ImmunizationCreate(**payload)
    assert obj.standardized_vaccine_who_code == "PCV-WHO-1234"


def test_update_accepts_standardized_vaccine_who_code_clear():
    obj = ImmunizationUpdate(standardized_vaccine_who_code=None)
    assert obj.standardized_vaccine_who_code is None


def test_response_exposes_standardized_vaccine_id():
    class Stub:
        id = 7
        vaccine_name = "MMR"
        date_administered = date(2024, 1, 1)
        patient_id = 1
        standardized_vaccine_id = 42
        vaccine_trade_name = None
        dose_number = None
        lot_number = None
        ndc_number = None
        manufacturer = None
        site = None
        route = None
        expiration_date = None
        location = None
        notes = None
        practitioner_id = None
        tags = None

    resp = ImmunizationResponse.model_validate(Stub())
    assert resp.standardized_vaccine_id == 42


def test_history_response_shape():
    item_payload = {
        "id": 1,
        "vaccine_name": "DTaP",
        "date_administered": date(2024, 1, 1),
        "patient_id": 1,
        "standardized_vaccine_id": 10,
        "components": ["Diphtheria", "Tetanus", "Pertussis"],
        "is_combined": True,
        "is_library_matched": True,
    }
    resp = ImmunizationHistoryResponse(
        items=[ImmunizationHistoryItem(**item_payload)],
        diseases_index={"Tetanus": [1], "Diphtheria": [1], "Pertussis": [1]},
        unmatched_count=0,
    )
    assert resp.unmatched_count == 0
    assert "Tetanus" in resp.diseases_index
