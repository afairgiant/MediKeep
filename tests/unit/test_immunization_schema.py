"""ImmunizationCreate expiration date ordering."""

import pytest
from pydantic import ValidationError

from app.schemas.immunization import ImmunizationCreate


def _create(expiration_date):
    return ImmunizationCreate(
        vaccine_name="Flu",
        date_administered="2020-01-01",
        expiration_date=expiration_date,
        patient_id=1,
    )


@pytest.mark.parametrize("expiration_date", ["2019-12-31", 0])
def test_expiration_before_administration_is_rejected(expiration_date):
    with pytest.raises(ValidationError, match="cannot be before administration"):
        _create(expiration_date)


def test_expiration_after_administration_is_accepted():
    assert str(_create("2021-01-01").expiration_date) == "2021-01-01"


def test_invalid_expiration_format_keeps_its_message():
    with pytest.raises(ValidationError, match="Invalid expiration date format"):
        _create("not-a-date")
