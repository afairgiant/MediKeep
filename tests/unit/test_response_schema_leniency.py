"""Response schemas must serialize any stored row instead of raising."""

import typing

import pytest
from fastapi.routing import iter_route_contexts
from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    EmailStr,
    Field,
    PlainSerializer,
    StrictInt,
    ValidationError,
    field_validator,
    model_validator,
)

from app.main import app
from app.schemas.read_model import LENIENT_MARKER, LENIENT_TYPES, read_model

# Validators on response classes that were reviewed to never reject stored data
READ_SIDE_VALIDATORS = {
    "TaggedEntityResponseMixin.validate_tags",
    "Patient.validate_address_response",
    "Patient.validate_gender_response",
    "Patient.convert_empty_strings_to_none_for_response",
    "FamilyMemberResponse.auto_correct_deceased_status",
    "EmergencyContactResponse.keep_blank_phone_number",
    "LabTestComponentResponse.validate_ref_range_text",
    "LabTestComponentResponse.validate_textual_value",
    "LabTestComponentResponse.validate_status",
    "LabTestComponentResponse.validate_result_type",
    "ConditionWithRelations.validate_patient",
    "ConditionWithRelations.validate_practitioner",
    "ConditionWithRelations.validate_treatments",
    "InjuryWithRelations.validate_injury_type",
    "InjuryWithRelations.validate_practitioner",
    "TreatmentWithRelations.validate_patient",
    "TreatmentWithRelations.validate_practitioner",
    "TreatmentWithRelations.validate_condition",
}

# Built on each request from parser output or live config, never from stored rows
NOT_FROM_STORED_ROWS = {
    "PDFExtractionResponse",
    "PDFExtractionMetadata",
    "SettingState",
}


def _models_in(annotation, found):
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        if annotation in found:
            return
        found.add(annotation)
        for info in annotation.model_fields.values():
            _models_in(info.annotation, found)
        return
    for arg in typing.get_args(annotation):
        _models_in(arg, found)


def _response_models():
    found = set()
    for context in iter_route_contexts(app.routes):
        response_model = getattr(context.route, "response_model", None)
        if response_model is not None:
            _models_in(response_model, found)
    return sorted(found, key=lambda m: f"{m.__module__}.{m.__qualname__}")


def _is_lenient(func):
    return getattr(func, LENIENT_MARKER, False)


def _is_lenient_item(item):
    return isinstance(item, (AfterValidator, BeforeValidator)) and _is_lenient(
        item.func
    )


def _strict_validators(model):
    decorators = model.__pydantic_decorators__
    strict = set()
    for name, dec in {
        **decorators.field_validators,
        **decorators.model_validators,
    }.items():
        if not _is_lenient(dec.func):
            owner = dec.func.__qualname__.split(".")[0]
            strict.add(f"{owner}.{name}")
    return strict


def _strict_parts_in(annotation, found):
    if annotation in LENIENT_TYPES:
        found.add(repr(annotation))
        return
    args = typing.get_args(annotation)
    if typing.get_origin(annotation) is typing.Annotated:
        found.update(repr(item) for item in args[1:] if not _is_lenient_item(item))
        args = args[:1]
    for arg in args:
        _strict_parts_in(arg, found)


def _strict_fields(model):
    strict = set()
    for field_name, info in model.model_fields.items():
        found = {repr(item) for item in info.metadata if not _is_lenient_item(item)}
        _strict_parts_in(info.annotation, found)
        strict.update(f"{model.__qualname__}.{field_name}: {item}" for item in found)
    return strict


RESPONSE_MODELS = [
    m for m in _response_models() if m.__qualname__ not in NOT_FROM_STORED_ROWS
]


def test_response_models_were_collected():
    names = {m.__qualname__ for m in RESPONSE_MODELS}
    assert {"EncounterResponse", "TreatmentResponse", "PatientResponse"} <= names


def test_allowlist_has_no_stale_entries():
    validators = set().union(*(_strict_validators(m) for m in RESPONSE_MODELS))
    assert READ_SIDE_VALIDATORS <= validators


@pytest.mark.parametrize("model", RESPONSE_MODELS, ids=lambda m: m.__qualname__)
def test_response_model_has_no_strict_validators(model):
    unexpected = _strict_validators(model) - READ_SIDE_VALIDATORS
    assert not unexpected, (
        f"{model.__qualname__} rejects stored data on read via {sorted(unexpected)}; "
        "inherit from read_model(<Base>) or add a reviewed read-side validator "
        "to READ_SIDE_VALIDATORS"
    )


@pytest.mark.parametrize("model", RESPONSE_MODELS, ids=lambda m: m.__qualname__)
def test_response_model_has_no_strict_fields(model):
    assert not _strict_fields(model)


def _make_base():
    class Base(BaseModel):
        name: str = Field(..., max_length=5)
        notes: typing.Optional[str] = None
        start: int = 0
        end: int = 0

        @field_validator("notes")
        @classmethod
        def validate_notes(cls, v):
            if v and len(v) > 5:
                raise ValueError("too long")
            return v.strip() if v else v

        @field_validator("end")
        @classmethod
        def validate_end(cls, v, info):
            if v < info.data.get("start", 0):
                raise ValueError("end before start")
            return v

        @model_validator(mode="after")
        def validate_order(self):
            if self.end < self.start:
                raise ValueError("bad order")
            return self

    return Base


class TestReadModel:
    def test_input_schema_still_rejects(self):
        base = _make_base()
        with pytest.raises(ValidationError):
            base(name="toolongname")
        with pytest.raises(ValidationError):
            base(name="ok", notes="x" * 10)
        with pytest.raises(ValidationError):
            base(name="ok", start=5, end=1)

    def test_read_copy_accepts_stored_values_that_break_rules(self):
        read = read_model(_make_base())
        row = read(name="toolongname", notes="x" * 10, start=5, end=1)
        assert row.name == "toolongname"
        assert row.notes == "x" * 10
        assert (row.start, row.end) == (5, 1)

    def test_read_copy_keeps_normalization_of_valid_values(self):
        read = read_model(_make_base())
        assert read(name="ok", notes=" hi ").notes == "hi"

    def test_read_copy_keeps_required_fields(self):
        with pytest.raises(ValidationError):
            read_model(_make_base())()

    def test_nested_models_become_lenient_and_accept_originals(self):
        inner = _make_base()

        class Outer(BaseModel):
            items: typing.List[inner] = []

        read = read_model(Outer)
        stored = read(items=[{"name": "toolongname"}])
        assert stored.items[0].name == "toolongname"
        built = read(items=[inner(name="ok", notes=" hi ")])
        assert built.items[0].notes == "hi"

    def test_read_copy_is_cached(self):
        base = _make_base()
        assert read_model(base) is read_model(base)

    def test_format_types_read_as_plain_types(self):
        class Contact(BaseModel):
            email: EmailStr
            backup: typing.Optional[EmailStr] = None

        with pytest.raises(ValidationError):
            Contact(email="admin@localhost")
        row = read_model(Contact)(email="admin@localhost", backup="not-an-email")
        assert (row.email, row.backup) == ("admin@localhost", "not-an-email")

    def test_nested_constraints_are_dropped(self):
        class Offsets(BaseModel):
            offsets: typing.Optional[
                typing.List[typing.Annotated[str, Field(max_length=2)]]
            ] = None
            counts: typing.List[StrictInt] = []

        with pytest.raises(ValidationError):
            Offsets(offsets=["toolong"])
        row = read_model(Offsets)(offsets=["toolong"], counts=["5"])
        assert (row.offsets, row.counts) == (["toolong"], [5])

    def test_any_validator_error_is_swallowed(self):
        class Lookup(BaseModel):
            code: str

            @field_validator("code")
            @classmethod
            def validate_code(cls, v):
                return {"a": "A"}[v]

        assert read_model(Lookup)(code="a").code == "A"
        assert read_model(Lookup)(code="zz").code == "zz"

    def test_unknown_field_metadata_is_rejected(self):
        class Serialized(BaseModel):
            value: typing.Annotated[int, PlainSerializer(str)] = 0

        with pytest.raises(TypeError):
            read_model(Serialized)

    def test_discriminated_union_is_rejected(self):
        class Cat(BaseModel):
            kind: typing.Literal["cat"] = "cat"

        class Dog(BaseModel):
            kind: typing.Literal["dog"] = "dog"

        class Pet(BaseModel):
            pet: typing.Union[Cat, Dog] = Field(..., discriminator="kind")

        with pytest.raises(TypeError):
            read_model(Pet)

    def test_mutually_recursive_models_are_rejected(self):
        class Parent(BaseModel):
            child: typing.Optional["Child"] = None

        class Child(BaseModel):
            parent: typing.Optional[Parent] = None

        Parent.model_rebuild(_types_namespace={"Child": Child})
        with pytest.raises(TypeError):
            read_model(Parent)
