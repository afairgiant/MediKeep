"""
API tests for the purpose of lab result links on conditions and procedures (#1128).

The purpose says why a lab result is linked (baseline, monitoring, outcome, safety or
other), like the purpose of a treatment's lab result links. It can be set and read from
both sides of the link; medication links have no purpose.
"""

from datetime import date, timedelta

import pytest

RECORD_BODIES = {
    "medications": {
        "medication_name": "Atorvastatin",
        "dosage": "20mg",
        "status": "active",
    },
    "procedures": {
        "procedure_name": "Appendectomy",
        "date": str(date.today() - timedelta(days=3)),
        "status": "completed",
    },
    "conditions": {"diagnosis": "Hypertension", "status": "active"},
}
FK = {
    "medications": "medication_id",
    "procedures": "procedure_id",
    "conditions": "condition_id",
}
PURPOSE_TYPES = ["procedures", "conditions"]


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


def _create_record(client, headers, record_type, patient_id):
    response = client.post(
        f"/api/v1/{record_type}/",
        json={**RECORD_BODIES[record_type], "patient_id": patient_id},
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def lab_result(client, authenticated_headers, patient_id):
    response = client.post(
        "/api/v1/lab-results/",
        json={
            "test_name": "Liver Function Panel",
            "test_category": "chemistry",
            "status": "completed",
            "patient_id": patient_id,
        },
        headers=authenticated_headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def make_record(client, authenticated_headers, patient_id):
    return lambda record_type: _create_record(
        client, authenticated_headers, record_type, patient_id
    )


@pytest.mark.parametrize("record_type", PURPOSE_TYPES)
class TestRecordSidePurpose:
    def test_create_with_purpose_and_read_it_back(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        created = client.post(
            url,
            json={
                "lab_result_id": lab_result["id"],
                "purpose": "monitoring",
                "relevance_note": "quarterly",
            },
            headers=authenticated_headers,
        )
        assert created.status_code == 200
        assert created.json()["purpose"] == "monitoring"

        rows = client.get(url, headers=authenticated_headers).json()
        assert [row["purpose"] for row in rows] == ["monitoring"]

    def test_purpose_is_optional(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        created = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"]},
            headers=authenticated_headers,
        )
        assert created.status_code == 200
        assert created.json()["purpose"] is None

    def test_purpose_is_normalized(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        created = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"], "purpose": "  Baseline "},
            headers=authenticated_headers,
        )
        assert created.status_code == 200
        assert created.json()["purpose"] == "baseline"

    def test_unknown_purpose_rejected(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        response = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "purpose": "fun"},
            headers=authenticated_headers,
        )
        assert response.status_code == 422
        assert client.get(url, headers=authenticated_headers).json() == []

    def test_update_and_clear_purpose_keeps_the_note(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        link = client.post(
            url,
            json={
                "lab_result_id": lab_result["id"],
                "purpose": "baseline",
                "relevance_note": "first draw",
            },
            headers=authenticated_headers,
        ).json()

        changed = client.put(
            f"{url}/{link['id']}",
            json={"purpose": "outcome", "relevance_note": "first draw"},
            headers=authenticated_headers,
        )
        assert changed.status_code == 200
        assert changed.json()["purpose"] == "outcome"
        assert changed.json()["relevance_note"] == "first draw"

        cleared = client.put(
            f"{url}/{link['id']}",
            json={"purpose": None, "relevance_note": "first draw"},
            headers=authenticated_headers,
        )
        assert cleared.status_code == 200
        assert cleared.json()["purpose"] is None
        assert cleared.json()["relevance_note"] == "first draw"

    def test_update_with_unknown_purpose_rejected(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        link = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "purpose": "safety"},
            headers=authenticated_headers,
        ).json()
        response = client.put(
            f"{url}/{link['id']}",
            json={"purpose": "fun"},
            headers=authenticated_headers,
        )
        assert response.status_code == 422
        assert client.get(url, headers=authenticated_headers).json()[0]["purpose"] == (
            "safety"
        )

    @pytest.mark.parametrize(
        "purpose", ["baseline", "monitoring", "outcome", "safety", "other"]
    )
    def test_every_allowed_purpose_is_accepted(
        self,
        record_type,
        purpose,
        client,
        authenticated_headers,
        make_record,
        lab_result,
    ):
        record = make_record(record_type)
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"], "purpose": purpose},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["purpose"] == purpose


@pytest.mark.parametrize("record_type", PURPOSE_TYPES)
class TestPurposeSeenFromBothSides:
    def test_purpose_set_on_the_record_shows_on_the_lab_result(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"], "purpose": "safety"},
            headers=authenticated_headers,
        )
        rows = client.get(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            headers=authenticated_headers,
        ).json()
        assert [row["purpose"] for row in rows] == ["safety"]

    def test_purpose_set_on_the_lab_result_shows_on_the_record(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        created = client.post(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            json={
                "lab_result_id": lab_result["id"],
                FK[record_type]: record["id"],
                "purpose": "outcome",
            },
            headers=authenticated_headers,
        )
        assert created.status_code == 200
        assert created.json()["purpose"] == "outcome"
        rows = client.get(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            headers=authenticated_headers,
        ).json()
        assert [row["purpose"] for row in rows] == ["outcome"]

    def test_purpose_updated_on_the_lab_result_shows_on_the_record(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        link = client.post(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            json={
                "lab_result_id": lab_result["id"],
                FK[record_type]: record["id"],
                "purpose": "baseline",
            },
            headers=authenticated_headers,
        ).json()
        changed = client.put(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}/{link['id']}",
            json={"purpose": "monitoring"},
            headers=authenticated_headers,
        )
        assert changed.status_code == 200
        assert changed.json()["purpose"] == "monitoring"
        rows = client.get(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            headers=authenticated_headers,
        ).json()
        assert [row["purpose"] for row in rows] == ["monitoring"]

    def test_unknown_purpose_rejected_on_the_lab_result_side(
        self, record_type, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record(record_type)
        response = client.post(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            json={
                "lab_result_id": lab_result["id"],
                FK[record_type]: record["id"],
                "purpose": "fun",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 422


class TestMedicationLinksHaveNoPurpose:
    def test_a_purpose_is_refused(
        self, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record("medications")
        url = f"/api/v1/medications/{record['id']}/lab-results"
        response = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "purpose": "baseline"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert client.get(url, headers=authenticated_headers).json() == []

    def test_update_with_a_purpose_is_refused(
        self, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record("medications")
        url = f"/api/v1/medications/{record['id']}/lab-results"
        link = client.post(
            url,
            json={"lab_result_id": lab_result["id"]},
            headers=authenticated_headers,
        ).json()
        response = client.put(
            f"{url}/{link['id']}",
            json={"purpose": "baseline"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_links_still_work_and_show_no_purpose(
        self, client, authenticated_headers, make_record, lab_result
    ):
        record = make_record("medications")
        url = f"/api/v1/medications/{record['id']}/lab-results"
        created = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "relevance_note": "n"},
            headers=authenticated_headers,
        )
        assert created.status_code == 200
        assert created.json()["purpose"] is None
        link_id = created.json()["id"]
        updated = client.put(
            f"{url}/{link_id}",
            json={"relevance_note": "changed"},
            headers=authenticated_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["relevance_note"] == "changed"
        assert updated.json()["purpose"] is None


@pytest.mark.parametrize("record_type", PURPOSE_TYPES)
class TestPartialUpdates:
    """A PUT changes only the fields it sends, as the API reference says."""

    @pytest.fixture
    def link(self, record_type, client, authenticated_headers, make_record, lab_result):
        record = make_record(record_type)
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        created = client.post(
            url,
            json={
                "lab_result_id": lab_result["id"],
                "purpose": "baseline",
                "relevance_note": "first draw",
            },
            headers=authenticated_headers,
        ).json()
        return f"{url}/{created['id']}"

    def test_sending_only_the_note_keeps_the_purpose(
        self, client, authenticated_headers, link
    ):
        response = client.put(
            link, json={"relevance_note": "changed"}, headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["relevance_note"] == "changed"
        assert response.json()["purpose"] == "baseline"

    def test_sending_only_the_purpose_keeps_the_note(
        self, client, authenticated_headers, link
    ):
        response = client.put(
            link, json={"purpose": "safety"}, headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["purpose"] == "safety"
        assert response.json()["relevance_note"] == "first draw"

    def test_sending_nothing_changes_nothing(self, client, authenticated_headers, link):
        response = client.put(link, json={}, headers=authenticated_headers)
        assert response.status_code == 200
        assert response.json()["purpose"] == "baseline"
        assert response.json()["relevance_note"] == "first draw"

    def test_null_clears_only_that_field(self, client, authenticated_headers, link):
        response = client.put(
            link, json={"purpose": None}, headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["purpose"] is None
        assert response.json()["relevance_note"] == "first draw"


def test_medication_link_update_sending_only_the_note_keeps_the_other_fields(
    client, authenticated_headers, make_record, lab_result
):
    record = make_record("medications")
    url = f"/api/v1/medications/{record['id']}/lab-results"
    created = client.post(
        url,
        json={"lab_result_id": lab_result["id"], "relevance_note": "first"},
        headers=authenticated_headers,
    ).json()
    response = client.put(
        f"{url}/{created['id']}", json={}, headers=authenticated_headers
    )
    assert response.status_code == 200
    assert response.json()["relevance_note"] == "first"
