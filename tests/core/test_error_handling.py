"""
Tests for the APIException base class and error handling system.

Validates the standardized error response payload (error_code, status, message,
description) for both APIException and its subclasses, ensuring regressions in
the handler and to_response_model logic are caught.
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.http.error_handling import (
    APIException,
    MedicalRecordsAPIException,
    ValidationException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    DatabaseException,
    BusinessLogicException,
    ServiceUnavailableException,
    setup_error_handling,
)
from app.core.http.response_models import (
    ExceptionCode,
    ExceptionCodeDefinition,
    ExceptionStatus,
)


# --- Unit tests for APIException and to_response_model ---


class TestAPIException:
    """Unit tests for the base APIException class."""

    def test_init_with_exception_code_definition(self):
        exc = APIException(ExceptionCode.BAD_REQUEST)
        assert exc.error_code == "BAD-400"
        assert exc.http_status_code == 400
        assert exc.message == "Bad Request"
        assert exc.description == "The request was invalid or cannot be served"
        assert exc.status == ExceptionStatus.FAIL
        assert exc.headers == {}

    def test_init_with_string_error_code(self):
        exc = APIException("CUSTOM-ERR", http_status_code=418, message="Teapot")
        assert exc.error_code == "CUSTOM-ERR"
        assert exc.http_status_code == 418
        assert exc.message == "Teapot"
        assert exc.description == ""

    def test_custom_message_overrides_definition_defaults(self):
        exc = APIException(
            ExceptionCode.NOT_FOUND,
            http_status_code=404,
            message="Patient not found",
            description="No patient with that ID",
        )
        assert exc.message == "Patient not found"
        assert exc.description == "No patient with that ID"
        assert exc.error_code == "NOT-404"

    def test_to_response_model_schema(self):
        exc = APIException(ExceptionCode.UNAUTHORIZED, http_status_code=401)
        model = exc.to_response_model()
        payload = model.model_dump(exclude_none=False)

        assert payload["status"] == "FAIL"
        assert payload["error_code"] == "AUTH-401"
        assert payload["message"] == "Unauthorized"
        assert payload["description"] == "Authentication is required to access this resource"
        assert payload["data"] is None
        assert payload["detail"] is None

    def test_to_response_model_with_data(self):
        exc = APIException(ExceptionCode.BAD_REQUEST)
        model = exc.to_response_model(data={"field": "name"})
        assert model.model_dump()["data"] == {"field": "name"}

    def test_inherits_from_exception(self):
        exc = APIException(ExceptionCode.BAD_REQUEST)
        assert isinstance(exc, Exception)
        assert str(exc) == "Bad Request"


class TestValidationException:
    """Tests for ValidationException with its overridden to_response_model."""

    def test_response_includes_validation_errors_in_detail(self):
        exc = ValidationException(
            validation_errors=["Name: This field is required", "Email: Invalid format"]
        )
        payload = exc.to_response_model().model_dump(exclude_none=False)

        assert payload["status"] == "FAIL"
        assert payload["error_code"] == "VAL-422"
        assert payload["message"] == "Validation failed"
        assert payload["detail"] == [
            "Name: This field is required",
            "Email: Invalid format",
        ]

    def test_empty_validation_errors_gives_none_detail(self):
        exc = ValidationException()
        payload = exc.to_response_model().model_dump(exclude_none=False)
        assert payload["detail"] is None


class TestExceptionSubclasses:
    """Verify each subclass sets the correct status code and error_code."""

    @pytest.mark.parametrize(
        "exc_class,expected_code,expected_status",
        [
            (lambda: UnauthorizedException(), "AUTH-401", 401),
            (lambda: ForbiddenException(), "PERM-403", 403),
            (lambda: NotFoundException(resource="Patient"), "NOT-404", 404),
            (lambda: ConflictException(), "CONF-409", 409),
            (lambda: DatabaseException(), "DB-500", 500),
            (lambda: BusinessLogicException(), "BIZ-400", 400),
            (lambda: ServiceUnavailableException(), "SVC-503", 503),
        ],
    )
    def test_subclass_defaults(self, exc_class, expected_code, expected_status):
        exc = exc_class()
        assert exc.error_code == expected_code
        assert exc.http_status_code == expected_status
        assert isinstance(exc, APIException)
        assert isinstance(exc, MedicalRecordsAPIException)

    def test_inheritance_chain(self):
        exc = NotFoundException(resource="Record")
        assert isinstance(exc, NotFoundException)
        assert isinstance(exc, MedicalRecordsAPIException)
        assert isinstance(exc, APIException)
        assert isinstance(exc, Exception)


class TestMedicalRecordsAPIExceptionHeaders:
    """Verify custom headers are stored and accessible."""

    def test_custom_headers(self):
        exc = UnauthorizedException(
            headers={"WWW-Authenticate": "Bearer"}
        )
        assert exc.headers == {"WWW-Authenticate": "Bearer"}

    def test_default_empty_headers(self):
        exc = NotFoundException(resource="Item")
        assert exc.headers == {}


# --- Integration tests: exception handler returns correct JSON payload ---


def _create_test_app():
    """Create a minimal FastAPI app with error handling for testing."""
    test_app = FastAPI()
    setup_error_handling(test_app)

    @test_app.get("/raise-not-found")
    def raise_not_found():
        raise NotFoundException(resource="Patient", message="Patient not found")

    @test_app.get("/raise-base-api-exception")
    def raise_base():
        raise APIException(
            ExceptionCode.BAD_REQUEST,
            http_status_code=400,
            message="Bad input",
            description="The input was malformed",
        )

    @test_app.get("/raise-validation")
    def raise_validation():
        raise ValidationException(
            message="Validation failed",
            validation_errors=["age: Must be greater than 0"],
        )

    @test_app.get("/raise-unauthorized-with-header")
    def raise_unauth():
        raise UnauthorizedException(
            message="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return test_app


@pytest.fixture
def error_client():
    """Test client with raise_server_exceptions=False so we get JSON error responses."""
    test_app = _create_test_app()
    with TestClient(test_app, raise_server_exceptions=False) as client:
        yield client


class TestErrorHandlerIntegration:
    """Integration tests verifying the JSON response payload from exception handlers."""

    def test_not_found_response_body(self, error_client):
        resp = error_client.get("/raise-not-found")
        assert resp.status_code == 404

        body = resp.json()
        assert body["status"] == "FAIL"
        assert body["error_code"] == "NOT-404"
        assert body["message"] == "Patient not found"
        assert body["description"] is not None
        assert body["data"] is None

    def test_base_api_exception_response_body(self, error_client):
        resp = error_client.get("/raise-base-api-exception")
        assert resp.status_code == 400

        body = resp.json()
        assert body["status"] == "FAIL"
        assert body["error_code"] == "BAD-400"
        assert body["message"] == "Bad input"
        assert body["description"] == "The input was malformed"

    def test_validation_response_includes_detail(self, error_client):
        resp = error_client.get("/raise-validation")
        assert resp.status_code == 422

        body = resp.json()
        assert body["status"] == "FAIL"
        assert body["error_code"] == "VAL-422"
        assert body["detail"] == ["age: Must be greater than 0"]

    def test_unauthorized_includes_www_authenticate_header(self, error_client):
        resp = error_client.get("/raise-unauthorized-with-header")
        assert resp.status_code == 401

        body = resp.json()
        assert body["error_code"] == "AUTH-401"
        assert body["message"] == "Token expired"
        assert resp.headers.get("WWW-Authenticate") == "Bearer"

    def test_response_has_all_required_fields(self, error_client):
        """Every error response must contain all five standard fields."""
        resp = error_client.get("/raise-not-found")
        body = resp.json()

        required_fields = {"status", "error_code", "message", "description", "data", "detail"}
        assert required_fields == set(body.keys())
