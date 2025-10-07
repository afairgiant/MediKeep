"""
Medical Record Status Enums

Standardized status values for all medical entities to ensure consistency
across the application and simplify frontend development.
"""

from enum import Enum


class BaseStatus(Enum):
    """Base status values common across most medical entities"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ConditionStatus(Enum):
    """Status values specific to medical conditions"""
    ACTIVE = "active"
    INACTIVE = "inactive" 
    RESOLVED = "resolved"  # Mapped from old "resolved"
    CHRONIC = "chronic"
    RECURRENCE = "recurrence"
    RELAPSE = "relapse"


class MedicationStatus(Enum):
    """Status values for medications"""
    ACTIVE = "active"
    STOPPED = "stopped"
    ON_HOLD = "on-hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AllergyStatus(Enum):
    """Status values for allergies"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    RESOLVED = "resolved"
    UNCONFIRMED = "unconfirmed"


class LabResultStatus(Enum):
    """Status values for lab results"""
    ORDERED = "ordered"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProcedureStatus(Enum):
    """Status values for procedures"""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TreatmentStatus(Enum):
    """Status values for treatments"""
    ACTIVE = "active"      # Mapped from old "ongoing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class EncounterPriority(Enum):
    """Priority levels for medical encounters"""
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class SeverityLevel(Enum):
    """Severity levels for conditions, allergies, etc."""
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    LIFE_THREATENING = "life-threatening"


class RelationshipToSelf(Enum):
    """Relationship of patient record to the account owner"""
    SELF = "self"
    SPOUSE = "spouse"
    PARTNER = "partner"
    CHILD = "child"
    SON = "son"
    DAUGHTER = "daughter"
    PARENT = "parent"
    FATHER = "father"
    MOTHER = "mother"
    SIBLING = "sibling"
    BROTHER = "brother"
    SISTER = "sister"
    GRANDPARENT = "grandparent"
    GRANDCHILD = "grandchild"
    OTHER_FAMILY = "other_family"
    FRIEND = "friend"
    OTHER = "other"


class FamilyRelationship(Enum):
    """Family relationship types for family history"""
    FATHER = "father"
    MOTHER = "mother"
    BROTHER = "brother"
    SISTER = "sister"
    PATERNAL_GRANDFATHER = "paternal_grandfather"
    PATERNAL_GRANDMOTHER = "paternal_grandmother"
    MATERNAL_GRANDFATHER = "maternal_grandfather"
    MATERNAL_GRANDMOTHER = "maternal_grandmother"
    UNCLE = "uncle"
    AUNT = "aunt"
    COUSIN = "cousin"
    OTHER = "other"


class ConditionType(Enum):
    """Medical condition types for categorization"""
    CARDIOVASCULAR = "cardiovascular"
    DIABETES = "diabetes"
    CANCER = "cancer"
    MENTAL_HEALTH = "mental_health"
    NEUROLOGICAL = "neurological"
    AUTOIMMUNE = "autoimmune"
    GENETIC = "genetic"
    RESPIRATORY = "respiratory"
    ENDOCRINE = "endocrine"
    OTHER = "other"


class InsuranceType(Enum):
    """Insurance types for categorization"""
    MEDICAL = "medical"
    DENTAL = "dental"
    VISION = "vision"
    PRESCRIPTION = "prescription"


class InsuranceStatus(Enum):
    """Status values for insurance policies"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    PENDING = "pending"


# Helper functions to get status lists for validation
def get_status_values(status_enum):
    """Get list of status values from enum"""
    return [status.value for status in status_enum]


def get_all_condition_statuses():
    """Get all valid condition status values"""
    return get_status_values(ConditionStatus)


def get_all_medication_statuses():
    """Get all valid medication status values"""
    return get_status_values(MedicationStatus)


def get_all_allergy_statuses():
    """Get all valid allergy status values"""
    return get_status_values(AllergyStatus)


def get_all_lab_result_statuses():
    """Get all valid lab result status values"""
    return get_status_values(LabResultStatus)


def get_all_procedure_statuses():
    """Get all valid procedure status values"""
    return get_status_values(ProcedureStatus)


def get_all_treatment_statuses():
    """Get all valid treatment status values"""
    return get_status_values(TreatmentStatus)


def get_all_severity_levels():
    """Get all valid severity levels"""
    return get_status_values(SeverityLevel)


def get_all_encounter_priorities():
    """Get all valid encounter priority levels"""
    return get_status_values(EncounterPriority)


def get_all_relationship_to_self():
    """Get all valid relationship to self values"""
    return get_status_values(RelationshipToSelf)


def get_all_family_relationships():
    """Get all valid family relationship types"""
    return get_status_values(FamilyRelationship)


def get_all_condition_types():
    """Get all valid condition types"""
    return get_status_values(ConditionType)


def get_all_insurance_types():
    """Get all valid insurance types"""
    return get_status_values(InsuranceType)


def get_all_insurance_statuses():
    """Get all valid insurance status values"""
    return get_status_values(InsuranceStatus)


# Status mapping for data migration (old -> new)
STATUS_MIGRATIONS = {
    'condition': {
        'resolved': 'resolved',  # Keep as is
        'stopped': 'inactive',   # Map stopped to inactive
    },
    'medication': {
        'stopped': 'inactive',   # Map stopped to inactive
        'on-hold': 'on_hold',    # Fix hyphen to underscore
    },
    'treatment': {
        'ongoing': 'active',     # Map ongoing to active
    },
    'procedure': {
        'in-progress': 'in_progress',  # Fix hyphen to underscore
    },
    'lab_result': {
        # No changes needed
    }
}