"""
Backward-compatibility re-export shim.

Models have been split into domain-specific modules for better organization.
See app/models/__init__.py for the full list of available models.

For new code, prefer importing from the domain-specific module:
    from app.models.user import User
    from app.models.clinical import Medication

Existing imports from this file continue to work:
    from app.models.models import User  # still works
"""

# Re-export all models via the package __init__.py (which defines __all__)
from app.models import *  # noqa: F401, F403

# Re-export enums for backward compatibility (not included in __init__.__all__)
from .enums import (  # noqa: F401
    AllergyStatus,
    ConditionStatus,
    ConditionType,
    EncounterPriority,
    FamilyRelationship,
    InjuryStatus,
    InsuranceStatus,
    InsuranceType,
    LabResultStatus,
    Laterality,
    MedicationStatus,
    MedicationType,
    ProcedureStatus,
    RelationshipToSelf,
    SeverityLevel,
    TreatmentStatus,
    get_all_allergy_statuses,
    get_all_condition_statuses,
    get_all_condition_types,
    get_all_encounter_priorities,
    get_all_family_relationships,
    get_all_injury_statuses,
    get_all_insurance_statuses,
    get_all_insurance_types,
    get_all_lab_result_statuses,
    get_all_laterality_values,
    get_all_medication_statuses,
    get_all_medication_types,
    get_all_procedure_statuses,
    get_all_relationship_to_self,
    get_all_severity_levels,
    get_all_treatment_statuses,
)
