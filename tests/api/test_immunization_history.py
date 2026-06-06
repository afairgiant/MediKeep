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
        components=["Diphtheria toxoid", "Tetanus toxoid", "Pertussis (acellular)"],
        disease_keys=["Diphtheria", "Tetanus", "Pertussis"],
        is_common=True,
    )
    mmr = StandardizedVaccine(
        who_code="MMR-TEST",
        vaccine_name="MMR",
        common_names=["MMR II"],
        is_combined=True,
        components=["Measles", "Mumps", "Rubella"],
        disease_keys=["Measles", "Mumps", "Rubella"],
        is_common=True,
    )
    flu = StandardizedVaccine(
        who_code="FLU-TEST",
        vaccine_name="Influenza",
        is_combined=False,
        disease_keys=["Influenza"],
        is_common=True,
    )
    # IPV + DTaP-IPV — used to verify the Polio split fix (issue #864).
    ipv = StandardizedVaccine(
        who_code="IPV-TEST",
        vaccine_name="Polio Vaccine - Inactivated (IPV)",
        short_name="IPV",
        common_names=["IPV", "Polio"],
        is_combined=False,
        disease_keys=["Polio"],
        is_common=True,
    )
    dtap_ipv = StandardizedVaccine(
        who_code="DTAP-IPV-TEST",
        vaccine_name="Diphtheria-Tetanus-Pertussis (acellular)-Polio (Inactivated)",
        short_name="DTaP-IPV",
        is_combined=True,
        components=[
            "Diphtheria toxoid",
            "Tetanus toxoid",
            "Pertussis (acellular)",
            "Polio (Inactivated)",
        ],
        disease_keys=["Diphtheria", "Tetanus", "Pertussis", "Polio"],
        is_common=False,
    )
    # DTaP-Hib has no WHO code (curated) — exercises the short_name fallback
    # path that issue #864 specifically broke.
    dtap_hib = StandardizedVaccine(
        who_code=None,
        vaccine_name="Diphtheria-Tetanus-Pertussis (acellular)-Haemophilus influenzae type b",
        short_name="DTaP-Hib",
        common_names=["DTaP/Hib", "Tetramune", "Infanrix-Hib"],
        is_combined=True,
        components=[
            "Diphtheria toxoid",
            "Tetanus toxoid",
            "Pertussis (acellular)",
            "Haemophilus influenzae type b",
        ],
        disease_keys=["Diphtheria", "Tetanus", "Pertussis", "Hib"],
        is_common=False,
    )
    db_session.add_all([dtap, mmr, flu, ipv, dtap_ipv, dtap_hib])
    db_session.commit()
    for v in (dtap, mmr, flu, ipv, dtap_ipv, dtap_hib):
        db_session.refresh(v)
    return {
        "dtap": dtap,
        "mmr": mmr,
        "flu": flu,
        "ipv": ipv,
        "dtap_ipv": dtap_ipv,
        "dtap_hib": dtap_hib,
    }


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
            db_session.add(
                Immunization(
                    patient_id=user_with_patient["patient"].id,
                    vaccine_name="Influenza",
                    date_administered=d,
                    standardized_vaccine_id=library["flu"].id,
                )
            )
        db_session.commit()

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        dates = [item["date_administered"] for item in resp.json()["items"]]
        assert dates == ["2024-01-01", "2022-01-01", "2020-01-01"]

    def test_name_match_backfills_standardized_vaccine_id(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        """Records that match the library by name (no FK set at create time)
        get their FK silently populated on the next history read, so they stop
        reporting as 'Unlinked' on subsequent fetches. Issue #864."""
        library = _seed_library(db_session)
        imm = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="DTaP-Hib",  # matched only via short_name index, FK=NULL
            date_administered=date(2024, 5, 1),
            standardized_vaccine_id=None,
        )
        db_session.add(imm)
        db_session.commit()
        db_session.refresh(imm)
        assert imm.standardized_vaccine_id is None  # precondition

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # After the read, the FK should be set to the library entry's id.
        db_session.refresh(imm)
        assert imm.standardized_vaccine_id == library["dtap_hib"].id, (
            "history-read should backfill standardized_vaccine_id when the "
            "resolver matched by name/short_name"
        )

    def test_bloated_display_string_record_auto_heals(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        """End-to-end heal path for records corrupted by v0.67.0's form bug:
        the picker saved the autocomplete display string as ``vaccine_name``
        instead of the short_name. A single history read should auto-link the
        record via the bloated-display alias in build_library_index — no data
        migration needed."""
        library = _seed_library(db_session)
        bloated = Immunization(
            patient_id=user_with_patient["patient"].id,
            # This is exactly what the broken form would have saved if the user
            # picked DTaP-Hib from autocomplete on v0.67.0.
            vaccine_name=(
                "Diphtheria-Tetanus-Pertussis (acellular)-Haemophilus "
                "influenzae type b (DTaP-Hib)"
            ),
            date_administered=date(2024, 4, 1),
            standardized_vaccine_id=None,
        )
        db_session.add(bloated)
        db_session.commit()
        db_session.refresh(bloated)
        assert bloated.standardized_vaccine_id is None

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()

        # Record is matched and grouped under the four DTaP-Hib diseases.
        item = next(i for i in body["items"] if i["id"] == bloated.id)
        assert item["is_library_matched"] is True
        assert set(item["components"]) == {
            "Diphtheria",
            "Tetanus",
            "Pertussis",
            "Hib",
        }

        # And the FK was silently backfilled — bloated vaccine_name still
        # present in the DB, but the link is now real.
        db_session.refresh(bloated)
        assert bloated.standardized_vaccine_id == library["dtap_hib"].id

    def test_polio_single_and_combo_share_one_disease_bucket(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        """Regression for issue #864: a standalone IPV record and a DTaP-IPV
        record must group under a single 'Polio' key, not two distinct strings."""
        library = _seed_library(db_session)
        ipv_record = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="IPV",
            date_administered=date(2024, 1, 15),
            standardized_vaccine_id=library["ipv"].id,
        )
        combo_record = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="DTaP-IPV",
            date_administered=date(2024, 6, 1),
            standardized_vaccine_id=library["dtap_ipv"].id,
        )
        db_session.add_all([ipv_record, combo_record])
        db_session.commit()
        db_session.refresh(ipv_record)
        db_session.refresh(combo_record)

        resp = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/history",
            headers=auth_headers,
        )
        body = resp.json()
        # The bug: two separate Polio-flavoured keys. The fix: exactly one.
        polio_keys = [k for k in body["diseases_index"] if "polio" in k.lower()]
        assert polio_keys == ["Polio"], (
            f"Expected one 'Polio' bucket, got {polio_keys!r} "
            f"(full index: {list(body['diseases_index'])})"
        )
        assert set(body["diseases_index"]["Polio"]) == {ipv_record.id, combo_record.id}

    def test_unlinked_short_name_record_resolves_via_short_name_index(
        self, client: TestClient, db_session, user_with_patient, auth_headers
    ):
        """Regression for issue #864: a record saved with vaccine_name='DTaP-Hib'
        and no FK (curated entries have no WHO code) must still resolve."""
        _seed_library(db_session)
        # Mirrors what the autocomplete picker writes: short_name in
        # vaccine_name, NULL FK because the library entry has no who_code.
        imm = Immunization(
            patient_id=user_with_patient["patient"].id,
            vaccine_name="DTaP-Hib",
            date_administered=date(2024, 5, 1),
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
        assert item["is_library_matched"] is True
        assert set(item["components"]) == {"Diphtheria", "Tetanus", "Pertussis", "Hib"}
        for disease in ("Diphtheria", "Tetanus", "Pertussis", "Hib"):
            assert imm.id in body["diseases_index"][disease], (
                f"Expected DTaP-Hib record under '{disease}' bucket, "
                f"got {body['diseases_index']}"
            )
        assert body["unmatched_count"] == 0

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
        assert resp.status_code == 403
