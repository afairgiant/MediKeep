"""Custom report tests for blood donations (record picker, filters, ownership, PDF)."""

from datetime import date

from fastapi.testclient import TestClient
from reportlab.platypus import Paragraph, Table
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.clinical import BloodDonation
from app.schemas.patient import PatientCreate
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from tests.utils.user import create_random_user

DONATIONS_URL = "/api/v1/blood-donations/"
SUMMARY_URL = "/api/v1/custom-reports/data-summary"
GENERATE_URL = "/api/v1/custom-reports/generate"


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


def _summary(client, headers, **params):
    response = client.get(SUMMARY_URL, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["categories"]["blood_donations"]


def _paragraphs(flowables):
    """Every Paragraph in a list of flowables, including those inside tables."""
    for flowable in flowables:
        if isinstance(flowable, Paragraph):
            yield flowable
        elif isinstance(flowable, Table):
            for row in flowable._cellvalues:
                yield from (cell for cell in row if isinstance(cell, Paragraph))


def _plain_text(flowables) -> str:
    return "\n".join(p.getPlainText() for p in _paragraphs(flowables))


class TestBloodDonationRecordPicker:
    def test_category_listed_with_translated_title_and_details(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            donation_type="plasma",
            location="Clinic",
            systolic_bp=120,
            diastolic_bp=80,
            hemoglobin=14.0,
        )

        category = _summary(client, authenticated_headers)

        assert category["count"] == 1
        record = category["records"][0]
        assert record["title"] == "Plasma"
        assert record["date"].startswith("2026-09-01")
        assert "Clinic" in record["key_info"]
        assert "120/80" in record["key_info"]
        assert "14.0 g/dL" in record["key_info"]

    def test_hemoglobin_in_details_follows_user_preference(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            hemoglobin=14.0,
        )
        response = client.put(
            "/api/v1/users/me/preferences",
            json={"hemoglobin_unit": "g_l"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text

        record = _summary(client, authenticated_headers)["records"][0]

        assert "140 g/L" in record["key_info"]
        assert "140.0" not in record["key_info"]

    def test_diastolic_only_blood_pressure_is_shown(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            diastolic_bp=80,
        )

        record = _summary(client, authenticated_headers)["records"][0]

        assert "?/80" in record["key_info"]

    def test_date_range_uses_donation_date(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        _create(client, authenticated_headers, patient_id, donation_date="2026-01-10")
        kept = _create(
            client, authenticated_headers, patient_id, donation_date="2026-06-10"
        )

        category = _summary(
            client,
            authenticated_headers,
            start_date="2026-05-01",
            end_date="2026-07-01",
        )

        assert [r["id"] for r in category["records"]] == [kept["id"]]

    def test_tag_filter_matches_donation_tags(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        tagged = _create(client, authenticated_headers, patient_id, tags=["Regular"])
        _create(client, authenticated_headers, patient_id)

        category = _summary(client, authenticated_headers, tags="regular")

        assert [r["id"] for r in category["records"]] == [tagged["id"]]


class TestBloodDonationReportGeneration:
    def test_generates_pdf_with_selected_donation(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        donation = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            temperature=98.6,
            hemoglobin=14.0,
            notes="Felt fine",
        )

        response = client.post(
            GENERATE_URL,
            json={
                "selected_records": [
                    {"category": "blood_donations", "record_ids": [donation["id"]]}
                ]
            },
            headers=authenticated_headers,
        )

        assert response.status_code == 200, response.text
        assert response.headers.get("content-type") == "application/pdf"

    def test_rejects_another_patients_donation(
        self, client: TestClient, db_session: Session, authenticated_headers
    ):
        other_user = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other_user["user"].id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="Patient",
                birth_date=date(1990, 1, 1),
                gender="F",
            ),
        )
        foreign = BloodDonation(
            patient_id=other_patient.id,
            donation_date=date(2026, 9, 1),
            donation_type="whole_blood",
        )
        db_session.add(foreign)
        db_session.commit()

        response = client.post(
            GENERATE_URL,
            json={
                "selected_records": [
                    {"category": "blood_donations", "record_ids": [foreign.id]}
                ]
            },
            headers=authenticated_headers,
        )

        assert response.status_code == 403


class TestBloodDonationPdfFormatter:
    RECORD = {
        "donation_date": "2026-09-01",
        "donation_type": "double_red_cells",
        "location": "Clinic",
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "temperature": 98.6,
        "hemoglobin": 14.0,
        "notes": "Felt fine",
        "tags": ["regular"],
    }

    def test_imperial_and_default_hemoglobin_unit(self):
        generator = CustomReportPDFGenerator()

        text = _plain_text(generator._format_blood_donations([self.RECORD]))

        assert "Double Red Cells" in text
        assert "Clinic" in text
        assert "120/80 mmHg" in text
        assert "98.6 °F" in text
        assert "14.0 g/dL" in text
        assert "Felt fine" in text
        assert "regular" in text

    def test_metric_temperature_and_mmol_hemoglobin(self):
        generator = CustomReportPDFGenerator()
        generator.unit_system = "metric"
        generator.hemoglobin_unit = "mmol_l"

        text = _plain_text(generator._format_blood_donations([self.RECORD]))

        assert "37.0 °C" in text
        assert "8.7 mmol/L" in text

    def test_diastolic_only_blood_pressure_is_shown(self):
        generator = CustomReportPDFGenerator()
        record = {**self.RECORD, "systolic_bp": None}

        text = _plain_text(generator._format_blood_donations([record]))

        assert "?/80 mmHg" in text

    def test_note_line_breaks_are_kept(self):
        generator = CustomReportPDFGenerator()
        record = {**self.RECORD, "notes": "Felt dizzy\r\nRested 20 min"}

        story = generator._format_blood_donations([record])

        markup = [p.text for p in _paragraphs(story)]
        assert "Felt dizzy<br/>Rested 20 min" in markup

    def test_newest_donation_first(self):
        generator = CustomReportPDFGenerator()
        older = {**self.RECORD, "donation_date": "2026-01-10", "location": "Older"}
        newer = {**self.RECORD, "donation_date": "2026-06-10", "location": "Newer"}

        text = _plain_text(generator._format_blood_donations([older, newer]))

        assert text.index("Newer") < text.index("Older")
