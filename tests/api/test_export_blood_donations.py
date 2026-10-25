"""Export tests for blood donations (JSON, CSV, PDF, summary, units)."""

from fastapi.testclient import TestClient

DONATIONS_URL = "/api/v1/blood-donations/"
EXPORT_URL = "/api/v1/export/data"


def _create(client, headers, patient_id, **overrides):
    payload = {
        "donation_date": "2026-09-01",
        "donation_type": "whole_blood",
        "patient_id": patient_id,
    }
    payload.update(overrides)
    response = client.post(DONATIONS_URL, json=payload, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _export(client, headers, **params):
    params.setdefault("format", "json")
    params.setdefault("scope", "blood_donations")
    return client.get(EXPORT_URL, params=params, headers=headers)


class TestBloodDonationExport:
    def test_scope_is_listed_in_formats(self, client: TestClient, authenticated_headers):
        response = client.get("/api/v1/export/formats", headers=authenticated_headers)
        scopes = {s["value"]: s for s in response.json()["scopes"]}
        assert scopes["blood_donations"]["label"]

    def test_json_export_newest_first_with_units(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id, donation_date="2026-01-10")
        _create(
            client,
            authenticated_headers,
            patient_id,
            donation_date="2026-03-10",
            donation_type="plasma",
            location="Clinic",
            systolic_bp=120,
            diastolic_bp=80,
            temperature=98.6,
            hemoglobin=14.0,
            tags=["regular"],
        )

        response = _export(client, authenticated_headers)

        assert response.status_code == 200
        rows = response.json()["blood_donations"]
        assert [r["donation_date"] for r in rows] == ["2026-03-10", "2026-01-10"]
        newest = rows[0]
        assert newest["donation_type"] == "plasma"
        assert newest["temperature"] == 98.6
        assert newest["temperature_unit"] == "°F"
        assert newest["hemoglobin"] == 14.0
        assert newest["hemoglobin_unit"] == "g/dL"
        assert newest["tags"] == ["regular"]

    def test_metric_system_converts_temperature(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id, temperature=98.6)

        row = _export(client, authenticated_headers, unit_system="metric").json()[
            "blood_donations"
        ][0]

        assert row["temperature"] == 37.0
        assert row["temperature_unit"] == "°C"

    def test_hemoglobin_follows_user_preference(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id, hemoglobin=14.0)
        client.put(
            "/api/v1/users/me/preferences",
            json={"hemoglobin_unit": "g_l"},
            headers=authenticated_headers,
        )

        row = _export(client, authenticated_headers).json()["blood_donations"][0]

        assert row["hemoglobin"] == 140
        assert row["hemoglobin_unit"] == "g/L"

    def test_date_range_filters_by_donation_date(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id, donation_date="2026-01-10")
        _create(client, authenticated_headers, patient_id, donation_date="2026-06-10")

        rows = _export(
            client,
            authenticated_headers,
            start_date="2026-05-01",
            end_date="2026-07-01",
        ).json()["blood_donations"]

        assert [r["donation_date"] for r in rows] == ["2026-06-10"]

    def test_all_scope_includes_donations(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(client, authenticated_headers, user_with_patient["patient"].id)

        data = _export(client, authenticated_headers, scope="all").json()

        assert len(data["blood_donations"]) == 1

    def test_csv_export_has_translated_values(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(client, authenticated_headers, user_with_patient["patient"].id)

        response = _export(client, authenticated_headers, format="csv")

        assert response.status_code == 200
        text = response.content.decode("utf-8")
        assert "BLOOD DONATIONS" in text
        assert "Donation Date" in text
        assert "2026-09-01" in text

    def test_pdf_export_renders(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            hemoglobin=13.5,
        )

        response = _export(client, authenticated_headers, format="pdf")

        assert response.status_code == 200
        assert response.content.startswith(b"%PDF")

    def test_summary_counts_donations(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id)
        _create(client, authenticated_headers, patient_id, donation_date="2026-02-01")

        response = client.get("/api/v1/export/summary", headers=authenticated_headers)

        assert response.json()["data"]["counts"]["blood_donations"] == 2
