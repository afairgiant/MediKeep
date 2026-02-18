from .base import Base, get_utc_now
from .activity_log import ActivityLog

from .user import (
    User,
    UserPreferences,
    UserTag,
    SystemSetting,
)

from .patient import (
    Patient,
    PatientPhoto,
    EmergencyContact,
    Insurance,
)

from .practice import (
    Practice,
    Practitioner,
    Pharmacy,
)

from .clinical import (
    Medication,
    Encounter,
    Condition,
    Immunization,
    Allergy,
    Vitals,
    Symptom,
    SymptomOccurrence,
)

from .labs import (
    LabResult,
    LabResultFile,
    LabTestComponent,
    StandardizedTest,
)

from .procedures import (
    Procedure,
    Treatment,
    MedicalEquipment,
)

from .injuries import (
    Injury,
    InjuryType,
)

from .family import (
    FamilyMember,
    FamilyCondition,
)

from .sharing import (
    PatientShare,
    Invitation,
    FamilyHistoryShare,
)

from .files import (
    EntityFile,
    BackupRecord,
)

from .reporting import (
    ReportTemplate,
    ReportGenerationAudit,
)

from .notifications import (
    NotificationChannel,
    NotificationPreference,
    NotificationHistory,
)

from .associations import (
    LabResultCondition,
    ConditionMedication,
    SymptomCondition,
    SymptomMedication,
    SymptomTreatment,
    InjuryMedication,
    InjuryCondition,
    InjuryTreatment,
    InjuryProcedure,
    TreatmentMedication,
    TreatmentEncounter,
    TreatmentLabResult,
    TreatmentEquipment,
)

__all__ = [
    "Base",
    "get_utc_now",
    "ActivityLog",
    "User",
    "UserPreferences",
    "UserTag",
    "SystemSetting",
    "Patient",
    "PatientPhoto",
    "EmergencyContact",
    "Insurance",
    "Practice",
    "Practitioner",
    "Pharmacy",
    "Medication",
    "Encounter",
    "Condition",
    "Immunization",
    "Allergy",
    "Vitals",
    "Symptom",
    "SymptomOccurrence",
    "LabResult",
    "LabResultFile",
    "LabTestComponent",
    "StandardizedTest",
    "Procedure",
    "Treatment",
    "MedicalEquipment",
    "Injury",
    "InjuryType",
    "FamilyMember",
    "FamilyCondition",
    "PatientShare",
    "Invitation",
    "FamilyHistoryShare",
    "EntityFile",
    "BackupRecord",
    "ReportTemplate",
    "ReportGenerationAudit",
    "NotificationChannel",
    "NotificationPreference",
    "NotificationHistory",
    "LabResultCondition",
    "ConditionMedication",
    "SymptomCondition",
    "SymptomMedication",
    "SymptomTreatment",
    "InjuryMedication",
    "InjuryCondition",
    "InjuryTreatment",
    "InjuryProcedure",
    "TreatmentMedication",
    "TreatmentEncounter",
    "TreatmentLabResult",
    "TreatmentEquipment",
]
