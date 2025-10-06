"""
Tests for Lab Result PDF Parsing functionality.

Tests the OCR extraction endpoint and text parsing logic.
"""
import pytest
import io
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestLabResultPDFParsing:
    """Test PDF parsing and OCR extraction for lab results."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with patient record for testing."""
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=user_data["user"].id, patient_data=patient_data
        )
        return {**user_data, "patient": patient}

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        """Create authentication headers."""
        return create_user_token_headers(user_with_patient["user"].id)

    @pytest.fixture
    def lab_result_id(self, client: TestClient, authenticated_headers):
        """Create a lab result for PDF upload tests."""
        lab_result_data = {
            "test_name": "CBC Panel",
            "test_code": "CBC",
            "result_value": "See PDF",
            "status": "final",
            "collected_date": "2024-01-01"
        }

        response = client.post(
            "/api/v1/lab-results/",
            json=lab_result_data,
            headers=authenticated_headers
        )

        assert response.status_code == 201
        return response.json()["id"]

    def create_pdf_file(self, content: bytes = None):
        """Create a mock PDF file for testing."""
        if content is None:
            # Minimal valid PDF structure
            content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Results) Tj
ET
endstream
endobj
%%EOF"""

        return io.BytesIO(content)

    # ========== File Upload Validation Tests ==========

    def test_pdf_upload_success(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test successful PDF upload and OCR extraction."""
        pdf_file = self.create_pdf_file()

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': 'WBC: 7.5 10^3/uL (4.0-11.0)\nRBC: 4.8 10^6/uL (4.5-5.5)',
                'metadata': {
                    'method': 'native',
                    'pages': 1,
                    'confidence': 0.95,
                    'processing_time_ms': 150
                }
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", pdf_file, "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data['status'] == 'success'
            assert 'WBC: 7.5' in data['extracted_text']
            assert data['metadata']['method'] == 'native'
            assert 'processing_time_ms' in data['metadata']

    def test_pdf_upload_invalid_file_type(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test rejection of non-PDF files."""
        text_file = io.BytesIO(b"This is not a PDF")

        response = client.post(
            f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
            files={"file": ("test.txt", text_file, "text/plain")},
            headers=authenticated_headers
        )

        assert response.status_code == 400
        assert "PDF file" in response.json()['detail']

    def test_pdf_upload_file_too_large(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test rejection of files exceeding size limit."""
        # Create a file larger than 15MB
        large_content = b"x" * (16 * 1024 * 1024)  # 16MB
        large_file = io.BytesIO(large_content)

        response = client.post(
            f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
            files={"file": ("large.pdf", large_file, "application/pdf")},
            headers=authenticated_headers
        )

        assert response.status_code == 400
        assert "File size exceeds" in response.json()['detail']

    def test_pdf_upload_missing_file(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test error when no file is provided."""
        response = client.post(
            f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_pdf_upload_nonexistent_lab_result(self, client: TestClient, authenticated_headers):
        """Test upload to non-existent lab result ID."""
        pdf_file = self.create_pdf_file()

        response = client.post(
            "/api/v1/lab-results/99999/ocr-parse",
            files={"file": ("test.pdf", pdf_file, "application/pdf")},
            headers=authenticated_headers
        )

        assert response.status_code == 404

    # ========== Text Parsing Pattern Tests ==========

    def test_parse_full_pattern_format(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing of full pattern format: 'Test Name: Value Unit (Ref: Range)'."""
        sample_text = """
        WBC: 7.5 10^3/uL (Ref: 4.0-11.0)
        RBC: 4.8 10^6/uL (Ref: 4.5-5.5)
        Hemoglobin: 14.5 g/dL (Ref: 13.5-17.5)
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC: 7.5' in data['extracted_text']
            assert 'Hemoglobin: 14.5' in data['extracted_text']

    def test_parse_tabular_format(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing of tab-separated tabular format."""
        sample_text = """
        Test Name\tValue\tUnit\tReference Range\tStatus
        WBC\t7.5\t10^3/uL\t4.0-11.0\tNormal
        RBC\t4.8\t10^6/uL\t4.5-5.5\tNormal
        Hemoglobin\t14.5\tg/dL\t13.5-17.5\tNormal
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC' in data['extracted_text']

    def test_parse_simple_format(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing of simple format: 'Test Name Value Unit'."""
        sample_text = """
        WBC 7.5 10^3/uL
        RBC 4.8 10^6/uL
        Hemoglobin 14.5 g/dL
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC 7.5' in data['extracted_text']

    def test_parse_csv_format(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing of CSV format."""
        sample_text = """
        Test Name,Value,Unit,Reference Range,Status
        WBC,7.5,10^3/uL,4.0-11.0,Normal
        RBC,4.8,10^6/uL,4.5-5.5,Normal
        Hemoglobin,14.5,g/dL,13.5-17.5,Normal
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC,7.5' in data['extracted_text']

    # ========== Edge Cases ==========

    def test_parse_empty_pdf(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test handling of empty PDF (no extractable text)."""
        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': '',
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("empty.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data['extracted_text'] == ''

    def test_parse_multiline_results(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing results that span multiple lines."""
        sample_text = """
        Hemoglobin A1c
          Result: 6.5%
          Reference: <5.7% (Normal)
                     5.7-6.4% (Pre-diabetic)
                     ≥6.5% (Diabetic)
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'Hemoglobin A1c' in data['extracted_text']
            assert '6.5%' in data['extracted_text']

    def test_parse_special_characters(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test handling of special characters in lab results."""
        sample_text = """
        WBC: 7.5 × 10³/µL (Ref: 4.0-11.0)
        Ca²⁺: 9.2 mg/dL (Ref: 8.5-10.5)
        Glucose: 95 mg/dL (Ref: 70-100) ✓
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC: 7.5' in data['extracted_text']

    def test_parse_qualitative_results(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing qualitative (non-numeric) results."""
        sample_text = """
        COVID-19 PCR: Detected
        Blood Type: A+
        Urinalysis - Glucose: Negative
        Urinalysis - Protein: Trace
        Culture: No growth
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'COVID-19 PCR: Detected' in data['extracted_text']
            assert 'Blood Type: A+' in data['extracted_text']

    def test_parse_with_footnotes_and_flags(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test parsing results with footnotes and special flags."""
        sample_text = """
        WBC: 15.2* 10^3/uL (Ref: 4.0-11.0) H
        RBC: 4.8 10^6/uL (Ref: 4.5-5.5)
        Hemoglobin: 12.1† g/dL (Ref: 13.5-17.5) L

        * Critical value - physician notified
        † Repeat testing recommended
        H = High
        L = Low
        """

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': sample_text,
                'metadata': {'method': 'native', 'pages': 1}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'WBC: 15.2*' in data['extracted_text']

    # ========== Error Handling Tests ==========

    def test_ocr_extraction_failure(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test handling of OCR extraction failures."""
        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.side_effect = Exception("OCR processing failed")

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("test.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 500
            data = response.json()
            assert 'error' in data['detail'].lower()

    def test_corrupted_pdf(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test handling of corrupted PDF files."""
        corrupted_pdf = io.BytesIO(b"This is not a valid PDF structure")

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.side_effect = Exception("Invalid PDF format")

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("corrupted.pdf", corrupted_pdf, "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 500

    # ========== Permission Tests ==========

    def test_pdf_upload_unauthorized(self, client: TestClient, lab_result_id):
        """Test PDF upload without authentication."""
        pdf_file = self.create_pdf_file()

        response = client.post(
            f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
            files={"file": ("test.pdf", pdf_file, "application/pdf")}
        )

        assert response.status_code == 401

    def test_pdf_upload_wrong_user(self, client: TestClient, db_session: Session):
        """Test that users cannot upload PDFs to other users' lab results."""
        # Create two users with lab results
        user1_data = create_random_user(db_session)
        patient1_data = PatientCreate(
            first_name="User", last_name="One",
            birth_date=date(1990, 1, 1), gender="M"
        )
        patient1 = patient_crud.create_for_user(
            db_session, user_id=user1_data["user"].id, patient_data=patient1_data
        )
        headers1 = create_user_token_headers(user1_data["user"].id)

        user2_data = create_random_user(db_session)
        headers2 = create_user_token_headers(user2_data["user"].id)

        # User1 creates lab result
        lab_result_data = {
            "test_name": "Private Test", "test_code": "PRIV",
            "status": "final", "collected_date": "2024-01-01"
        }
        create_response = client.post(
            "/api/v1/lab-results/", json=lab_result_data, headers=headers1
        )
        lab_result_id = create_response.json()["id"]

        # User2 tries to upload PDF to User1's lab result
        pdf_file = self.create_pdf_file()
        response = client.post(
            f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
            files={"file": ("test.pdf", pdf_file, "application/pdf")},
            headers=headers2
        )

        assert response.status_code == 404  # Not found (for security - don't reveal existence)

    # ========== Performance Tests ==========

    def test_large_pdf_processing(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test processing of large PDF with many test results."""
        # Generate text with 100 test results
        large_text = "\n".join([
            f"Test_{i}: {10.0 + i*0.1} mg/dL (Ref: 5.0-15.0)"
            for i in range(100)
        ])

        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': large_text,
                'metadata': {'method': 'native', 'pages': 5}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("large.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert 'Test_0:' in data['extracted_text']
            assert 'Test_99:' in data['extracted_text']

    def test_multi_page_pdf(self, client: TestClient, lab_result_id, authenticated_headers):
        """Test processing of multi-page PDF."""
        with patch('app.services.pdf_extraction_service.extract_text') as mock_extract:
            mock_extract.return_value = {
                'extracted_text': 'Page 1 results\nWBC: 7.5\n\nPage 2 results\nRBC: 4.8',
                'metadata': {'method': 'native', 'pages': 2}
            }

            response = client.post(
                f"/api/v1/lab-results/{lab_result_id}/ocr-parse",
                files={"file": ("multipage.pdf", self.create_pdf_file(), "application/pdf")},
                headers=authenticated_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data['metadata']['pages'] == 2
            assert 'Page 1 results' in data['extracted_text']
            assert 'Page 2 results' in data['extracted_text']
