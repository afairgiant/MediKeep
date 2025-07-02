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
    INACTIVE = "inactive"  # Mapped from old "stopped"
    ON_HOLD = "on_hold"    # Mapped from old "on-hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AllergyStatus(Enum):
    """Status values for allergies"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    RESOLVED = "resolved"


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
    CRITICAL = "critical"


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