"""One valid record of every type files can be attached to, keyed by export scope."""

from app.models.models import (
    Allergy,
    Condition,
    Encounter,
    Immunization,
    Injury,
    Insurance,
    LabResult,
    MedicalEquipment,
    Medication,
    Procedure,
    Symptom,
    Treatment,
)
from app.services.export_attachments import ATTACHMENT_SOURCES

# scope -> (entity type files are stored under, record name, builder(patient_id, day))
RECORDS = {
    "medications": (
        "medication",
        "Lisinopril",
        lambda pid, day: Medication(
            patient_id=pid, medication_name="Lisinopril", effective_period_start=day
        ),
    ),
    "lab_results": (
        "lab-result",
        "Panel",
        lambda pid, day: LabResult(
            patient_id=pid,
            test_name="Panel",
            status="completed",
            ordered_date=day,
            completed_date=day,
        ),
    ),
    "allergies": (
        "allergy",
        "Peanut",
        lambda pid, day: Allergy(
            patient_id=pid, allergen="Peanut", reaction="Hives", onset_date=day
        ),
    ),
    "conditions": (
        "condition",
        "Asthma",
        lambda pid, day: Condition(
            patient_id=pid,
            condition_name="Asthma",
            diagnosis="Asthma",
            status="active",
            onset_date=day,
        ),
    ),
    "immunizations": (
        "immunization",
        "Flu",
        lambda pid, day: Immunization(
            patient_id=pid, vaccine_name="Flu", date_administered=day
        ),
    ),
    "procedures": (
        "procedure",
        "Biopsy",
        lambda pid, day: Procedure(patient_id=pid, procedure_name="Biopsy", date=day),
    ),
    "treatments": (
        "treatment",
        "Physio",
        lambda pid, day: Treatment(
            patient_id=pid, treatment_name="Physio", start_date=day
        ),
    ),
    "encounters": (
        "encounter",
        "Checkup",
        lambda pid, day: Encounter(patient_id=pid, reason="Checkup", date=day),
    ),
    "symptoms": (
        "symptom",
        "Cough",
        lambda pid, day: Symptom(
            patient_id=pid, symptom_name="Cough", first_occurrence_date=day
        ),
    ),
    "injuries": (
        "injury",
        "Sprain",
        lambda pid, day: Injury(
            patient_id=pid, injury_name="Sprain", body_part="Ankle", date_of_injury=day
        ),
    ),
    "insurance": (
        "insurance",
        "Aetna",
        lambda pid, day: Insurance(
            patient_id=pid,
            insurance_type="medical",
            company_name="Aetna",
            member_name="Test User",
            member_id="M1",
            effective_date=day,
            status="active",
        ),
    ),
    "medical_equipment": (
        "medical-equipment",
        "CPAP",
        lambda pid, day: MedicalEquipment(
            patient_id=pid,
            equipment_name="CPAP",
            equipment_type="cpap",
            status="active",
            prescribed_date=day,
        ),
    ),
}


def add_record_for_every_file_entity_type(db_session, patient_id, day):
    """Add one record per attachment source.

    Returns an (entity type, record) pair for every entity type files can be attached
    to, so the encounter is returned twice: under "encounter" and under "visit".
    """
    pairs = []
    for source in ATTACHMENT_SOURCES:
        record = RECORDS[source.scope][2](patient_id, day)
        db_session.add(record)
        db_session.commit()
        pairs.extend((entity_type, record) for entity_type in source.entity_types)
    return pairs
