"""
Tests for injuries and symptoms in the unified search endpoint, and for their
registration in the tag search entity lists.
"""

import inspect
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints import tags as tags_endpoint
from app.crud.patient import patient as patient_crud
from app.models.models import Injury, MedicalEquipment, Symptom
from app.schemas.patient import PatientCreate
from app.services.tag_service import tag_service
from tests.utils.user import create_random_user, create_user_token_headers


def _make_injury(db: Session, patient_id: int, **overrides) -> Injury:
    fields = {
        "patient_id": patient_id,
        "injury_name": "Sprained ankle",
        "body_part": "Ankle",
        "status": "active",
        "date_of_injury": date.today() - timedelta(days=10),
        "tags": [],
    }
    fields.update(overrides)
    injury = Injury(**fields)
    db.add(injury)
    db.commit()
    db.refresh(injury)
    return injury


def _make_symptom(db: Session, patient_id: int, **overrides) -> Symptom:
    fields = {
        "patient_id": patient_id,
        "symptom_name": "Persistent headache",
        "status": "active",
        "is_chronic": False,
        "first_occurrence_date": date.today() - timedelta(days=5),
        "tags": [],
    }
    fields.update(overrides)
    symptom = Symptom(**fields)
    db.add(symptom)
    db.commit()
    db.refresh(symptom)
    return symptom


def _make_equipment(db: Session, patient_id: int, **overrides) -> MedicalEquipment:
    fields = {
        "patient_id": patient_id,
        "equipment_name": "CPAP machine",
        "equipment_type": "CPAP",
        "status": "active",
        "prescribed_date": date.today() - timedelta(days=20),
        "tags": [],
    }
    fields.update(overrides)
    equipment = MedicalEquipment(**fields)
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


class TestSearchInjuries:
    def test_injuries_included_in_default_search(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_injury(db_session, user_with_patient["patient"].id)

        response = client.get("/api/v1/search/", headers=authenticated_headers)

        assert response.status_code == 200
        assert response.json()["results"]["injuries"]["count"] == 1

    def test_search_injuries_by_name_body_part_mechanism_notes_and_tag(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_injury(
            db_session,
            user_with_patient["patient"].id,
            injury_name="Hairline fracture",
            body_part="Left wrist",
            mechanism="Fell from bicycle",
            notes="Cast for six weeks",
            tags=["sports-injury"],
        )

        for term in ("hairline", "wrist", "bicycle", "cast for", "sports-injury"):
            response = client.get(
                f"/api/v1/search/?q={term}&types=injuries",
                headers=authenticated_headers,
            )
            assert response.status_code == 200, term
            assert response.json()["results"]["injuries"]["count"] == 1, term

    def test_search_injuries_item_uses_model_field_names(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        injury = _make_injury(
            db_session, user_with_patient["patient"].id, severity="moderate"
        )

        response = client.get(
            "/api/v1/search/?q=ankle&types=injuries", headers=authenticated_headers
        )

        item = response.json()["results"]["injuries"]["items"][0]
        assert item["type"] == "injury"
        assert item["id"] == injury.id
        assert item["injury_name"] == "Sprained ankle"
        assert item["body_part"] == "Ankle"
        assert item["severity"] == "moderate"
        assert item["status"] == "active"
        assert item["date_of_injury"] == injury.date_of_injury.isoformat()
        # Keys must match real Injury columns so tag-search rows read the same way
        for key in ("injury_name", "body_part", "date_of_injury"):
            assert key in Injury.__table__.columns

    def test_undated_injuries_sort_last_in_both_directions(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        _make_injury(
            db_session,
            patient_id,
            injury_name="Dated old",
            date_of_injury=date.today() - timedelta(days=100),
        )
        _make_injury(
            db_session,
            patient_id,
            injury_name="Dated new",
            date_of_injury=date.today() - timedelta(days=1),
        )
        _make_injury(db_session, patient_id, injury_name="Undated", date_of_injury=None)

        for sort, expected in (
            ("date_desc", ["Dated new", "Dated old", "Undated"]),
            ("date_asc", ["Dated old", "Dated new", "Undated"]),
        ):
            response = client.get(
                f"/api/v1/search/?types=injuries&sort={sort}",
                headers=authenticated_headers,
            )
            names = [
                i["injury_name"]
                for i in response.json()["results"]["injuries"]["items"]
            ]
            assert names == expected, sort

    def test_injuries_date_filter(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        _make_injury(
            db_session,
            patient_id,
            injury_name="Recent",
            date_of_injury=date.today() - timedelta(days=2),
        )
        _make_injury(
            db_session,
            patient_id,
            injury_name="Old",
            date_of_injury=date.today() - timedelta(days=200),
        )

        date_from = (date.today() - timedelta(days=30)).isoformat()
        response = client.get(
            f"/api/v1/search/?types=injuries&date_from={date_from}",
            headers=authenticated_headers,
        )

        items = response.json()["results"]["injuries"]["items"]
        assert [i["injury_name"] for i in items] == ["Recent"]

    def test_types_filter_excludes_injuries(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_injury(db_session, user_with_patient["patient"].id)

        response = client.get(
            "/api/v1/search/?types=medications", headers=authenticated_headers
        )

        assert "injuries" not in response.json()["results"]


class TestSearchSymptoms:
    def test_symptoms_included_in_default_search(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_symptom(db_session, user_with_patient["patient"].id)

        response = client.get("/api/v1/search/", headers=authenticated_headers)

        assert response.status_code == 200
        assert response.json()["results"]["symptoms"]["count"] == 1

    def test_search_symptoms_by_name_notes_and_tag(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_symptom(
            db_session,
            user_with_patient["patient"].id,
            symptom_name="Dizziness",
            general_notes="Worse when standing quickly",
            tags=["neuro-watch"],
        )

        for term in ("dizz", "standing quickly", "neuro-watch"):
            response = client.get(
                f"/api/v1/search/?q={term}&types=symptoms",
                headers=authenticated_headers,
            )
            assert response.status_code == 200, term
            assert response.json()["results"]["symptoms"]["count"] == 1, term

    def test_search_symptoms_item_uses_model_field_names(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        symptom = _make_symptom(
            db_session, user_with_patient["patient"].id, category="neurological"
        )

        response = client.get(
            "/api/v1/search/?q=headache&types=symptoms", headers=authenticated_headers
        )

        item = response.json()["results"]["symptoms"]["items"][0]
        assert item["type"] == "symptom"
        assert item["id"] == symptom.id
        assert item["symptom_name"] == "Persistent headache"
        assert item["category"] == "neurological"
        assert item["status"] == "active"
        assert (
            item["first_occurrence_date"] == symptom.first_occurrence_date.isoformat()
        )
        for key in ("symptom_name", "category", "first_occurrence_date"):
            assert key in Symptom.__table__.columns

    def test_symptoms_sort_by_title(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        _make_symptom(db_session, patient_id, symptom_name="Zeta")
        _make_symptom(db_session, patient_id, symptom_name="Alpha")

        response = client.get(
            "/api/v1/search/?types=symptoms&sort=title", headers=authenticated_headers
        )

        names = [
            i["symptom_name"] for i in response.json()["results"]["symptoms"]["items"]
        ]
        assert names == ["Alpha", "Zeta"]


class TestSearchMedicalEquipment:
    def test_equipment_included_in_default_search(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_equipment(db_session, user_with_patient["patient"].id)

        response = client.get("/api/v1/search/", headers=authenticated_headers)

        assert response.status_code == 200
        assert response.json()["results"]["medical_equipment"]["count"] == 1

    def test_search_equipment_by_each_text_field_and_tag(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_equipment(
            db_session,
            user_with_patient["patient"].id,
            equipment_name="Nebulizer",
            equipment_type="Respiratory",
            manufacturer="Acme Medical",
            model_number="NB-2000",
            supplier="HomeCare Supply",
            notes="Clean filter weekly",
            tags=["breathing-aid"],
        )

        for term in (
            "nebul",
            "respiratory",
            "acme",
            "nb-2000",
            "homecare",
            "clean filter",
            "breathing-aid",
        ):
            response = client.get(
                f"/api/v1/search/?q={term}&types=medical_equipment",
                headers=authenticated_headers,
            )
            assert response.status_code == 200, term
            assert response.json()["results"]["medical_equipment"]["count"] == 1, term

    def test_search_equipment_item_uses_model_field_names(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        equipment = _make_equipment(
            db_session, user_with_patient["patient"].id, manufacturer="ResMed"
        )

        response = client.get(
            "/api/v1/search/?q=cpap&types=medical_equipment",
            headers=authenticated_headers,
        )

        item = response.json()["results"]["medical_equipment"]["items"][0]
        assert item["type"] == "medical_equipment"
        assert item["id"] == equipment.id
        assert item["equipment_name"] == "CPAP machine"
        assert item["equipment_type"] == "CPAP"
        assert item["manufacturer"] == "ResMed"
        assert item["status"] == "active"
        assert item["prescribed_date"] == equipment.prescribed_date.isoformat()
        for key in ("equipment_name", "equipment_type", "prescribed_date"):
            assert key in MedicalEquipment.__table__.columns

    def test_undated_equipment_sorts_last_and_date_filter_applies(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        _make_equipment(
            db_session,
            patient_id,
            equipment_name="Old",
            prescribed_date=date.today() - timedelta(days=300),
        )
        _make_equipment(
            db_session,
            patient_id,
            equipment_name="New",
            prescribed_date=date.today() - timedelta(days=2),
        )
        _make_equipment(
            db_session, patient_id, equipment_name="Undated", prescribed_date=None
        )

        for sort, expected in (
            ("date_desc", ["New", "Old", "Undated"]),
            ("date_asc", ["Old", "New", "Undated"]),
        ):
            response = client.get(
                f"/api/v1/search/?types=medical_equipment&sort={sort}",
                headers=authenticated_headers,
            )
            items = response.json()["results"]["medical_equipment"]["items"]
            assert [i["equipment_name"] for i in items] == expected, sort

        date_from = (date.today() - timedelta(days=30)).isoformat()
        response = client.get(
            f"/api/v1/search/?types=medical_equipment&date_from={date_from}",
            headers=authenticated_headers,
        )
        items = response.json()["results"]["medical_equipment"]["items"]
        assert [i["equipment_name"] for i in items] == ["New"]


class TestInjurySymptomIsolation:
    def test_other_users_records_not_returned(
        self, client: TestClient, db_session: Session
    ):
        owner = create_random_user(db_session)
        owner_patient = patient_crud.create_for_user(
            db_session,
            user_id=owner["user"].id,
            patient_data=PatientCreate(
                first_name="Owner",
                last_name="One",
                birth_date=date(1990, 1, 1),
                gender="M",
            ),
        )
        other = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other["user"].id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="Two",
                birth_date=date(1990, 1, 1),
                gender="F",
            ),
        )
        other["user"].active_patient_id = other_patient.id
        db_session.commit()
        db_session.refresh(other["user"])
        other_headers = create_user_token_headers(other["user"].username)

        _make_injury(db_session, owner_patient.id, injury_name="PrivateInjury987")
        _make_symptom(db_session, owner_patient.id, symptom_name="PrivateSymptom987")
        _make_equipment(
            db_session, owner_patient.id, equipment_name="PrivateEquipment987"
        )

        response = client.get(
            "/api/v1/search/?q=Private&types=injuries&types=symptoms"
            "&types=medical_equipment",
            headers=other_headers,
        )

        assert response.status_code == 200
        results = response.json()["results"]
        assert results["injuries"]["count"] == 0
        assert results["symptoms"]["count"] == 0
        assert results["medical_equipment"]["count"] == 0


class TestTagSearchRegistration:
    """Tag search is raw SQL over ENTITY_TABLES; an unregistered type returns nothing."""

    @pytest.mark.parametrize(
        "entity_type,table",
        [
            ("injury", "injuries"),
            ("symptom", "symptoms"),
            ("medical_equipment", "medical_equipment"),
        ],
    )
    def test_entity_registered_with_real_table(self, entity_type, table):
        assert tag_service.ENTITY_TABLES[entity_type] == table
        assert tag_service._validate_entity_type(entity_type) == table
        assert table in Injury.metadata.tables

    @pytest.mark.parametrize(
        "endpoint",
        [
            tags_endpoint.search_by_tags_across_entities,
            tags_endpoint.get_popular_tags_across_entities,
        ],
    )
    def test_endpoint_defaults_include_new_entities(self, endpoint):
        default = inspect.signature(endpoint).parameters["entity_types"].default.default
        assert "injury" in default
        assert "symptom" in default
        assert "medical_equipment" in default
