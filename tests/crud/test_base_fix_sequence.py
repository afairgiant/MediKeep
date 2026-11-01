"""CRUDBase sequence recovery: PostgreSQL only, id clashes only, parameters only."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.crud.medication import medication as medication_crud
from app.schemas.medication import MedicationCreate

ID_CLASH = (
    'duplicate key value violates unique constraint "medications_pkey"\n'
    "DETAIL:  Key (id)=(5) already exists."
)
NAME_CLASH = (
    'duplicate key value violates unique constraint "uq_name"\n'
    "DETAIL:  Key (name)=(x) already exists."
)


def _postgres_session(max_id: int, new_value=1) -> MagicMock:
    db = MagicMock()
    db.bind.dialect.name = "postgresql"
    db.scalar.side_effect = [max_id, new_value]
    return db


def _integrity_error(message: str) -> IntegrityError:
    return IntegrityError("INSERT", {}, Exception(message))


class TestFixSequence:
    def test_skips_other_databases(self):
        db = MagicMock()
        db.bind.dialect.name = "mysql"

        assert medication_crud._fix_sequence(db) is False
        db.scalar.assert_not_called()

    def test_sequence_reset_sends_table_and_max_id_as_parameters(self):
        db = _postgres_session(max_id=41, new_value=41)

        assert medication_crud._fix_sequence(db) is True

        statement, params = db.scalar.call_args.args
        assert "medications" not in str(statement)
        assert "41" not in str(statement)
        assert params == {"table": "medications", "max_id": 41}
        db.commit.assert_called_once()

    def test_no_owned_sequence_is_not_a_success(self):
        db = _postgres_session(max_id=41, new_value=None)

        assert medication_crud._fix_sequence(db) is False
        db.commit.assert_not_called()

    def test_failure_rolls_back_and_returns_false(self):
        db = _postgres_session(max_id=0, new_value=RuntimeError("database gone"))

        assert medication_crud._fix_sequence(db) is False
        db.rollback.assert_called_once()


class TestCreateAfterDuplicateKey:
    @pytest.fixture
    def medication_in(self):
        return MedicationCreate(medication_name="Med", patient_id=1, status="active")

    def test_clash_on_another_column_does_not_touch_the_sequence(
        self, monkeypatch, medication_in
    ):
        fix = MagicMock(return_value=True)
        monkeypatch.setattr(medication_crud, "_fix_sequence", fix)
        db = MagicMock()
        db.commit.side_effect = _integrity_error(NAME_CLASH)

        with pytest.raises(IntegrityError, match="(?i)duplicate medication record"):
            medication_crud.create(db, obj_in=medication_in)
        fix.assert_not_called()

    def test_retry_failure_is_wrapped_and_rolled_back(self, monkeypatch, medication_in):
        monkeypatch.setattr(medication_crud, "_fix_sequence", lambda db: True)
        db = MagicMock()
        db.commit.side_effect = [
            _integrity_error(ID_CLASH),
            _integrity_error(ID_CLASH),
        ]

        with pytest.raises(IntegrityError, match="(?i)duplicate medication record"):
            medication_crud.create(db, obj_in=medication_in)
        assert db.rollback.call_count == 2

    def test_retry_succeeds_after_the_fix(self, monkeypatch, medication_in):
        monkeypatch.setattr(medication_crud, "_fix_sequence", lambda db: True)
        db = MagicMock()
        db.commit.side_effect = [_integrity_error(ID_CLASH), None]

        created = medication_crud.create(db, obj_in=medication_in)

        assert created.medication_name == "Med"
        assert db.commit.call_count == 2
