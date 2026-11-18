"""Blood donations in the unified search endpoint and in tag search."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.search import SEARCH_TYPE_MODELS
from app.models.models import BloodDonation
from app.services.tag_service import ENTITY_MODELS
from tests.utils.user import create_test_user_with_patient, create_user_token_headers


def _make_donation(db: Session, patient_id: int, **overrides) -> BloodDonation:
    fields = {
        "patient_id": patient_id,
        "donation_date": date.today() - timedelta(days=10),
        "donation_type": "whole_blood",
        "location": "City Hospital",
        "tags": [],
    }
    fields.update(overrides)
    donation = BloodDonation(**fields)
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation


class TestSearchBloodDonations:
    def test_blood_donations_included_in_default_search(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_donation(db_session, user_with_patient["patient"].id)

        response = client.get("/api/v1/search/", headers=authenticated_headers)

        assert response.status_code == 200
        assert response.json()["results"]["blood_donations"]["count"] == 1

    @pytest.mark.parametrize(
        "q,expected",
        [
            ("double_red", 1),
            ("Double Red", 1),
            ("red cross", 1),
            ("dizzy", 1),
            ("mobile-drive", 1),
            ("nomatch123", 0),
        ],
    )
    def test_text_query_matches_type_location_notes_and_tag(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        q,
        expected,
    ):
        _make_donation(
            db_session,
            user_with_patient["patient"].id,
            donation_type="double_red_cells",
            location="Red Cross blood drive",
            notes="Felt dizzy afterwards",
            tags=["mobile-drive"],
        )

        response = client.get(
            f"/api/v1/search/?q={q}&types=blood_donations",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        assert response.json()["results"]["blood_donations"]["count"] == expected

    def test_item_fields(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        donation = _make_donation(
            db_session, user_with_patient["patient"].id, tags=["regular"]
        )

        response = client.get(
            "/api/v1/search/?types=blood_donations", headers=authenticated_headers
        )

        item = response.json()["results"]["blood_donations"]["items"][0]
        assert item == {
            "id": donation.id,
            "type": "blood_donation",
            "donation_type": "whole_blood",
            "location": "City Hospital",
            "donation_date": donation.donation_date.isoformat(),
            "tags": ["regular"],
            "highlight": "whole_blood",
            "score": 0.9,
        }

    def test_date_filter_and_sort(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        for days_ago, location in ((2, "Recent"), (20, "Middle"), (200, "Old")):
            _make_donation(
                db_session,
                patient_id,
                location=location,
                donation_date=date.today() - timedelta(days=days_ago),
            )

        date_from = (date.today() - timedelta(days=30)).isoformat()
        filtered = client.get(
            f"/api/v1/search/?types=blood_donations&date_from={date_from}",
            headers=authenticated_headers,
        )
        oldest_first = client.get(
            "/api/v1/search/?types=blood_donations&sort=date_asc",
            headers=authenticated_headers,
        )

        filtered_items = filtered.json()["results"]["blood_donations"]["items"]
        assert [i["location"] for i in filtered_items] == ["Recent", "Middle"]
        sorted_items = oldest_first.json()["results"]["blood_donations"]["items"]
        assert [i["location"] for i in sorted_items] == ["Old", "Middle", "Recent"]

    def test_types_filter_excludes_blood_donations(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        _make_donation(db_session, user_with_patient["patient"].id)

        response = client.get(
            "/api/v1/search/?types=medications", headers=authenticated_headers
        )

        assert "blood_donations" not in response.json()["results"]

    def test_tag_search_returns_blood_donations(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        donation = _make_donation(
            db_session, user_with_patient["patient"].id, tags=["plasma-club"]
        )

        response = client.get(
            "/api/v1/tags/search?tags=plasma-club&entity_types=blood_donation",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        rows = response.json()["blood_donation"]
        assert [row["id"] for row in rows] == [donation.id]


class TestBloodDonationSearchIsolation:
    def test_other_users_donations_not_returned(
        self, client: TestClient, db_session: Session, user_with_patient
    ):
        _make_donation(
            db_session, user_with_patient["patient"].id, location="PrivateClinic987"
        )
        other = create_test_user_with_patient(db_session)

        response = client.get(
            "/api/v1/search/?q=PrivateClinic987&types=blood_donations",
            headers=create_user_token_headers(other["user"].username),
        )

        assert response.status_code == 200
        assert response.json()["results"]["blood_donations"]["count"] == 0


class TestSearchTypeRegistry:
    def test_every_taggable_record_type_is_text_searchable(self):
        missing = set(ENTITY_MODELS.values()) - set(SEARCH_TYPE_MODELS.values())
        assert not missing, sorted(model.__name__ for model in missing)

    @pytest.mark.parametrize("group_key", sorted(SEARCH_TYPE_MODELS))
    def test_every_registered_type_returns_its_group(
        self, client: TestClient, authenticated_headers, group_key
    ):
        response = client.get(
            f"/api/v1/search/?types={group_key}", headers=authenticated_headers
        )

        assert response.status_code == 200
        assert group_key in response.json()["results"]

    def test_default_search_returns_every_registered_type(
        self, client: TestClient, authenticated_headers
    ):
        response = client.get("/api/v1/search/", headers=authenticated_headers)

        assert set(response.json()["results"]) == set(SEARCH_TYPE_MODELS)
