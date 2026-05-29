"""Tests for the Immunization history endpoint."""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.clinical import Immunization, StandardizedVaccine
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


def _seed_library(db_session: Session) -> dict[str, StandardizedVaccine]:
    """Seed minimal library entries used by the history tests."""
    dtap = StandardizedVaccine(
        who_code="DTAP-TEST",
        vaccine_name="DTaP",
        is_combined=True,
        components=["Diphtheria", "Tetanus", "Pertussis"],
        is_common=True,
    )
    mmr = StandardizedVaccine(
        who_code="MMR-TEST",
        vaccine_name="MMR",
        common_names=["MMR II"],
        is_combined=True,
        components=["Measles", "Mumps", "Rubella"],
        is_common=True,
    )
    flu = StandardizedVaccine(
        who_code="FLU-TEST",
        vaccine_name="Influenza",
        is_combined=False,
        is_common=True,
    )
    db_session.add_all([dtap, mmr, flu])
    db_session.commit()
    db_session.refresh(dtap)
    db_session.refresh(mmr)
    db_session.refresh(flu)
    return {"dtap": dtap, "mmr": mmr, "flu": flu}


class TestImmunizationHistory:
    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        user_data = create_random_user(db_session)
        patient = patient_crud.create_for_user(
            db_session,
            user_id=user_data["user"].id,
            patient_data=PatientCreate(
                first_name="John",
                last_name="Doe",
                birth_date=date(1990, 1, 1),
                gender="M",
                address="123 Main St",
            ),
        )
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def auth_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    def test_returns_empty_response_when_no_immunizations(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["diseases_index"] == {}
        assert body["unmatched_count"] == 0

    def test_resolves_combined_vaccine_via_fk(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        library = _seed_library(db_session)
        imm = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="DTaP",
            date_administered=date(2024, 3, 15),
            standardized_vaccine_id=library["dtap"].id,
        )
        db_session.add(imm)
        db_session.commit()
        db_session.refresh(imm)

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 1
        item = body["items"][0]
        assert set(item["components"]) == {"Diphtheria", "Tetanus", "Pertussis"}
        assert item["is_combined"] is True
        assert item["is_library_matched"] is True
        for disease in ("Diphtheria", "Tetanus", "Pertussis"):
            assert imm.id in body["diseases_index"][disease]
        assert body["unmatched_count"] == 0

    def test_resolves_via_name_match_when_no_fk(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        library = _seed_library(db_session)
        imm = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="mmr",  # lowercase to verify case-insensitive
            date_administered=date(2024, 3, 15),
            standardized_vaccine_id=None,
        )
        db_session.add(imm)
        db_session.commit()
        db_session.refresh(imm)

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        body = resp.json()
        item = body["items"][0]
        assert set(item["components"]) == {"Measles", "Mumps", "Rubella"}
        assert item["is_library_matched"] is True
        assert body["unmatched_count"] == 0

    def test_unmatched_record_contributes_to_unmatched_count(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        _seed_library(db_session)
        imm = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="Bigfoot Vaccine",
            date_administered=date(2024, 3, 15),
        )
        db_session.add(imm)
        db_session.commit()

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        body = resp.json()
        item = body["items"][0]
        assert item["components"] == []
        assert item["is_library_matched"] is False
        assert body["unmatched_count"] == 1
        assert body["diseases_index"] == {}  # unmatched records contribute no diseases

    def test_date_range_filtering(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        library = _seed_library(db_session)
        old = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="Influenza",
            date_administered=date(2020, 1, 1),
            standardized_vaccine_id=library["flu"].id,
        )
        recent = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="Influenza",
            date_administered=date(2024, 1, 1),
            standardized_vaccine_id=library["flu"].id,
        )
        db_session.add_all([old, recent])
        db_session.commit()

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            params={"start_date": "2023-01-01"},
            headers=auth_headers,
        )
        body = resp.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["date_administered"] == "2024-01-01"

    def test_results_ordered_newest_first(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        library = _seed_library(db_session)
        for d in [date(2020, 1, 1), date(2024, 1, 1), date(2022, 1, 1)]:
            db_session.add(Immunization(
                patient_id=user_with_patient["patient"].id,
                vaccine_name="Influenza",
                date_administered=d,
                standardized_vaccine_id=library["flu"].id,
            ))
        db_session.commit()

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        dates = [item["date_administered"] for item in resp.json()["items"]]
        assert dates == ["2024-01-01", "2022-01-01", "2020-01-01"]

    def test_cross_patient_access_blocked(
        self, client: TestClient, db_session, auth_headers
    ):
        other_user = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other_user["user"].id,
            patient_data=PatientCreate(
                first_name="Jane",
                last_name="Other",
                birth_date=date(1985, 1, 1),
                gender="F",
                address="456 Other St",
            ),
        )
        resp = client.get(
            f"/api/v1/immunizations/patient/{other_patient.id}/history",
            headers=auth_headers,
        )
        assert resp.status_code in (403, 404)
