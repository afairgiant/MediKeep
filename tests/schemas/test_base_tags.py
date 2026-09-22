"""
Tests for TaggedEntityMixin / TaggedEntityUpdateMixin (app/schemas/base_tags.py).

Regression coverage for the insurance-print stored XSS (see
docs/working_docs/Security/insurance-print-xss-1040-1041.md, public issue
#1040): tags previously had no character restriction, so a tag like
``<script>alert(1)</script>`` passed validation untouched and was later
rendered unescaped in the print template. The fix adds a strict allowlist
(letters, digits, ``.``/``-``/``:``) to the mixin shared by all 11 taggable
schemas, so most of this is tested at the mixin level rather than against
any one entity.

TestUpdateSchemasEnforceAllowlist additionally covers a second bypass found
while making this fix: every entity's ``*Update`` schema (used for PUT/PATCH)
declared its own unvalidated ``tags: Optional[List[str]] = None`` field
instead of going through the mixin, so edits to an *existing* record could
set an XSS payload with zero validation even after the Create-path fix.
That is now closed by having every ``*Update`` schema inherit
``TaggedEntityUpdateMixin`` instead.
"""

import pytest
from pydantic import ValidationError

from app.schemas.allergy import AllergyUpdate
from app.schemas.base_tags import TaggedEntityMixin, TaggedEntityUpdateMixin
from app.schemas.condition import ConditionUpdate
from app.schemas.encounter import EncounterUpdate
from app.schemas.immunization import ImmunizationUpdate
from app.schemas.injury import InjuryUpdate
from app.schemas.insurance import InsuranceUpdate
from app.schemas.lab_result import LabResultUpdate
from app.schemas.medical_equipment import MedicalEquipmentUpdate
from app.schemas.medication import MedicationUpdate
from app.schemas.procedure import ProcedureUpdate
from app.schemas.treatment import TreatmentUpdate


class _TaggedModel(TaggedEntityMixin):
    pass


class _TaggedUpdateModel(TaggedEntityUpdateMixin):
    pass


ALL_UPDATE_SCHEMAS = [
    AllergyUpdate,
    ConditionUpdate,
    EncounterUpdate,
    ImmunizationUpdate,
    InjuryUpdate,
    InsuranceUpdate,
    LabResultUpdate,
    MedicalEquipmentUpdate,
    MedicationUpdate,
    ProcedureUpdate,
    TreatmentUpdate,
]


class TestValidateTagsAllowlist:
    def test_alphanumeric_tags_pass(self):
        model = _TaggedModel(tags=["diabetes", "Type2", "covid19"])
        assert set(model.tags) == {"diabetes", "type2", "covid19"}

    def test_allowed_punctuation_passes(self):
        model = _TaggedModel(tags=["sars-cov-2", "v1.2", "urgent:high"])
        assert set(model.tags) == {"sars-cov-2", "v1.2", "urgent:high"}

    def test_spaces_are_normalized_to_hyphen_before_check(self):
        model = _TaggedModel(tags=["pre diabetes"])
        assert model.tags == ["pre-diabetes"]

    @pytest.mark.parametrize(
        "payload",
        [
            "<script>alert(document.cookie)</script>",
            "<img/src=x/onerror=alert(1)>",
            "</title><script>alert(1)</script>",
            "&lt;script&gt;",
            "&#60;script&#62;",
            "tag&amp;",
            'tag"onmouseover=alert(1)',
            "tag'onmouseover=alert(1)",
            "tag`template`",
            "tag$injection",
            "tag;drop",
        ],
    )
    def test_html_and_entity_injection_rejected(self, payload):
        with pytest.raises(ValidationError):
            _TaggedModel(tags=[payload])

    def test_unicode_letters_allowed(self):
        # Non-ASCII locale content (e.g. accented characters) must keep
        # working; only markup/entity-decode characters are blocked.
        model = _TaggedModel(tags=["diabète", "présión"])
        assert set(model.tags) == {"diabète", "présión"}

    def test_tag_count_and_length_limits_still_enforced(self):
        with pytest.raises(ValidationError):
            _TaggedModel(tags=[f"tag{i}" for i in range(16)])

        with pytest.raises(ValidationError):
            _TaggedModel(tags=["a" * 51])

    def test_none_tags_normalizes_to_empty_list(self):
        model = _TaggedModel(tags=None)
        assert model.tags == []


class TestUpdateSchemasEnforceAllowlist:
    """Every real *Update schema must reject the same payloads as Create."""

    @pytest.mark.parametrize("schema", ALL_UPDATE_SCHEMAS)
    def test_xss_payload_rejected(self, schema):
        with pytest.raises(ValidationError):
            schema(tags=["<script>alert(document.cookie)</script>"])

    @pytest.mark.parametrize("schema", ALL_UPDATE_SCHEMAS)
    def test_valid_tag_normalized(self, schema):
        instance = schema(tags=["Pre Diabetes"])
        assert instance.tags == ["pre-diabetes"]

    @pytest.mark.parametrize("schema", ALL_UPDATE_SCHEMAS)
    def test_omitted_tags_means_no_change(self, schema):
        # Partial-update semantics: omitting tags must NOT reset them to [].
        instance = schema()
        assert instance.tags is None

    @pytest.mark.parametrize("schema", ALL_UPDATE_SCHEMAS)
    def test_tag_count_limit_enforced(self, schema):
        with pytest.raises(ValidationError):
            schema(tags=[f"tag{i}" for i in range(16)])


class TestTaggedEntityUpdateMixinDirectly:
    def test_none_preserved_as_no_change(self):
        model = _TaggedUpdateModel(tags=None)
        assert model.tags is None

    def test_default_is_none_not_empty_list(self):
        model = _TaggedUpdateModel()
        assert model.tags is None

    def test_provided_list_goes_through_same_allowlist(self):
        with pytest.raises(ValidationError):
            _TaggedUpdateModel(tags=["<img/src=x/onerror=alert(1)>"])
