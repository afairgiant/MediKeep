"""Imaging studies in the unified search endpoint."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import ImagingStudy

URL = "/api/v1/search/"


def _make_study(db: Session, patient_id: int, uid: str, **overrides) -> ImagingStudy:
    fields = {
        "patient_id": patient_id,
        "study_instance_uid": uid,
        "study_date": date(2026, 5, 1),
        "modalities": ["CT"],
        "study_description": "CT CHEST",
        "body_part": "CHEST",
        "series_count": 1,
        "instance_count": 1,
        "total_size": 1,
        "tags": [],
    }
    fields.update(overrides)
    study = ImagingStudy(**fields)
    db.add(study)
    db.commit()
    db.refresh(study)
    return study


class TestSearchImagingStudies:
    def test_included_in_default_search(
        self, client: TestClient, db_session, user_with_patient, authenticated_headers
    ):
        _make_study(db_session, user_with_patient["patient"].id, "1.1")

        response = client.get(URL, headers=authenticated_headers)

        assert response.status_code == 200
        group = response.json()["results"]["imaging_studies"]
        assert group["count"] == 1
        item = group["items"][0]
        assert item["type"] == "imaging_study"
        assert item["modalities"] == ["CT"]
        assert item["study_date"] == "2026-05-01"

    @pytest.mark.parametrize(
        "q,expected",
        [("chest", 1), ("knee", 0), ("nodule", 1), ("follow", 1), ("ortho", 1)],
    )
    def test_text_matches_description_report_notes_and_tags(
        self, client, db_session, user_with_patient, authenticated_headers, q, expected
    ):
        _make_study(
            db_session,
            user_with_patient["patient"].id,
            "1.2",
            report_text="Small nodule in the right lung.",
            notes="Follow-up in 6 months",
            tags=["ortho"],
        )

        response = client.get(
            URL,
            params={"q": q, "types": "imaging_studies"},
            headers=authenticated_headers,
        )

        assert response.json()["results"]["imaging_studies"]["count"] == expected

    def test_date_filter_and_undated_last(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _make_study(db_session, patient_id, "1.3", study_date=date(2025, 1, 1))
        _make_study(db_session, patient_id, "1.4", study_date=None)
        _make_study(db_session, patient_id, "1.5", study_date=date(2026, 6, 1))

        all_items = client.get(
            URL, params={"types": "imaging_studies"}, headers=authenticated_headers
        ).json()["results"]["imaging_studies"]["items"]
        filtered = client.get(
            URL,
            params={"types": "imaging_studies", "date_from": "2026-01-01"},
            headers=authenticated_headers,
        ).json()["results"]["imaging_studies"]

        assert [i["study_date"] for i in all_items] == [
            "2026-06-01",
            "2025-01-01",
            None,
        ]
        assert filtered["count"] == 1

    def test_other_patients_studies_are_not_returned(
        self, client, db_session, user_with_patient, authenticated_headers, test_user
    ):
        from app.crud.patient import patient as patient_crud
        from app.schemas.patient import PatientCreate

        other = patient_crud.create_for_user(
            db_session,
            user_id=test_user.id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="P",
                birth_date=date(1990, 1, 1),
                gender="F",
            ),
        )
        _make_study(db_session, other.id, "1.6")

        response = client.get(
            URL, params={"types": "imaging_studies"}, headers=authenticated_headers
        )

        assert response.json()["results"]["imaging_studies"]["count"] == 0
