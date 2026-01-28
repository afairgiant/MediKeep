"""
Export Service for Medical Records

This service handles the business logic for exporting patient medical data
in various formats including JSON, CSV, and PDF.
"""

import csv
import io
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session, joinedload

from app.core.logging.config import get_logger
from app.models.models import (
    Allergy,
    Condition,
    EmergencyContact,
    Encounter,
    FamilyCondition,
    FamilyMember,
    Immunization,
    Injury,
    Insurance,
    LabResult,
    Medication,
    Patient,
    Pharmacy,
    Practitioner,
    Procedure,
    Symptom,
    SymptomOccurrence,
    Treatment,
    User,
    Vitals,
)

logger = get_logger(__name__, "app")

# Unit labels for imperial and metric systems
UNIT_LABELS = {
    "imperial": {"weight": "lbs", "height": "inches", "temperature": "°F"},
    "metric": {"weight": "kg", "height": "cm", "temperature": "°C"},
}


class UnitConverter:
    """Utility class for converting between imperial and metric units."""

    @staticmethod
    def lbs_to_kg(pounds: Optional[float]) -> Optional[float]:
        """Convert pounds to kilograms."""
        if pounds is None:
            return None
        return round(float(pounds) * 0.453592, 1)

    @staticmethod
    def inches_to_cm(inches: Optional[float]) -> Optional[float]:
        """Convert inches to centimeters."""
        if inches is None:
            return None
        return round(float(inches) * 2.54, 1)

    @staticmethod
    def fahrenheit_to_celsius(fahrenheit: Optional[float]) -> Optional[float]:
        """Convert Fahrenheit to Celsius."""
        if fahrenheit is None:
            return None
        return round((float(fahrenheit) - 32) * 5 / 9, 1)

    @staticmethod
    def calculate_bmi(
        weight_kg: Optional[float], height_cm: Optional[float]
    ) -> Optional[float]:
        """Calculate BMI from metric units (kg and cm)."""
        if weight_kg is None or height_cm is None:
            return None
        if height_cm <= 0:
            return None
        # BMI = weight(kg) / height(m)^2
        height_m = float(height_cm) / 100
        return round(float(weight_kg) / (height_m * height_m), 1)

    @staticmethod
    def get_unit_labels(unit_system: str) -> Dict[str, str]:
        """Get unit labels for a given unit system."""
        return UNIT_LABELS.get(unit_system, UNIT_LABELS["imperial"])


class ExportService:
    """Service for exporting patient medical data in various formats."""

    def __init__(self, db: Session):
        self.db = db

    async def export_patient_data(
        self,
        user_id: int,
        format: str,
        scope: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        include_files: bool = False,
        include_patient_info: bool = True,
        unit_system: str = "imperial",
    ) -> Dict[str, Union[Any, List[Dict[str, Any]]]]:
        """
        Export patient data based on specified parameters.

        Args:
            user_id: ID of the user requesting export
            format: Export format (json, csv, pdf)
            scope: Data scope (all, medications, lab_results, etc.)
            start_date: Filter records from this date
            end_date: Filter records up to this date
            include_files: Whether to include file attachments
            include_patient_info: Whether to include patient information
            unit_system: Unit system for measurements ('imperial' or 'metric')

        Returns:
            Dictionary containing exported data
        """
        try:
            # Get the active patient for the user
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")

            if not user.active_patient_id:
                raise ValueError("No active patient selected")

            patient = (
                self.db.query(Patient)
                .filter(Patient.id == user.active_patient_id)
                .first()
            )
            if not patient:
                raise ValueError("Active patient record not found")

            # Validate unit_system
            if unit_system not in ("imperial", "metric"):
                unit_system = "imperial"

            export_data = {
                "export_metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "format": format,  # Use the actual format requested
                    "scope": scope,
                    "include_files": include_files,
                    "include_patient_info": include_patient_info,
                    "unit_system": unit_system,
                    "date_range": {
                        "start": start_date.isoformat() if start_date else None,
                        "end": end_date.isoformat() if end_date else None,
                    },
                },
            }

            # Conditionally include patient info
            if include_patient_info:
                export_data["patient_info"] = self._get_patient_info(
                    patient, unit_system
                )

            # Export based on scope
            if scope == "all":
                export_data.update(
                    await self._export_all_data(
                        patient, start_date, end_date, include_files, unit_system
                    )
                )
            elif scope == "medications":
                medications_data = self._export_medications(
                    patient, start_date, end_date
                )
                export_data["medications"] = medications_data
                logger.info(
                    f"Medications export: found {len(medications_data)} records"
                )
                if medications_data:
                    logger.info(f"First medication sample: {medications_data[0]}")
                else:
                    logger.info("No medications found for export")
            elif scope == "lab_results":
                export_data["lab_results"] = self._export_lab_results(
                    patient, start_date, end_date, include_files
                )
            elif scope == "allergies":
                export_data["allergies"] = self._export_allergies(
                    patient, start_date, end_date
                )
            elif scope == "conditions":
                export_data["conditions"] = self._export_conditions(
                    patient, start_date, end_date
                )
            elif scope == "immunizations":
                export_data["immunizations"] = self._export_immunizations(
                    patient, start_date, end_date
                )
            elif scope == "procedures":
                export_data["procedures"] = self._export_procedures(
                    patient, start_date, end_date
                )
            elif scope == "treatments":
                export_data["treatments"] = self._export_treatments(
                    patient, start_date, end_date
                )
            elif scope == "encounters":
                export_data["encounters"] = self._export_encounters(
                    patient, start_date, end_date
                )
            elif scope == "vitals":
                export_data["vitals"] = self._export_vitals(
                    patient, start_date, end_date, unit_system
                )
            elif scope == "emergency_contacts":
                export_data["emergency_contacts"] = self._export_emergency_contacts(
                    patient, start_date, end_date
                )
            elif scope == "practitioners":
                export_data["practitioners"] = self._export_practitioners(
                    patient, start_date, end_date
                )
            elif scope == "pharmacies":
                export_data["pharmacies"] = self._export_pharmacies(
                    patient, start_date, end_date
                )
            elif scope == "symptoms":
                export_data["symptoms"] = self._export_symptoms(
                    patient, start_date, end_date
                )
            elif scope == "injuries":
                export_data["injuries"] = self._export_injuries(
                    patient, start_date, end_date
                )
            elif scope == "family_history":
                export_data["family_history"] = self._export_family_history(
                    patient, start_date, end_date
                )
            elif scope == "insurance":
                export_data["insurance"] = self._export_insurance(
                    patient, start_date, end_date
                )
            else:
                raise ValueError(f"Unsupported export scope: {scope}")

            logger.info(f"Successfully exported {scope} data for patient {patient.id}")

            # Always return the dictionary data - let the API endpoint handle format conversion
            return export_data

        except Exception as e:
            logger.error(f"Export failed for user {user_id}: {str(e)}")
            raise

    def _get_patient_info(
        self, patient: Patient, unit_system: str = "imperial"
    ) -> Dict[str, Any]:
        """Get basic patient information with unit conversion."""
        # Get unit labels for the selected system
        unit_labels = UnitConverter.get_unit_labels(unit_system)

        # Convert height and weight based on unit system
        if unit_system == "metric":
            height_value = UnitConverter.inches_to_cm(patient.height)
            weight_value = UnitConverter.lbs_to_kg(patient.weight)
        else:
            height_value = patient.height
            weight_value = patient.weight

        return {
            "id": patient.id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "birth_date": (
                patient.birth_date.isoformat()
                if patient.birth_date is not None
                else None
            ),
            "blood_type": patient.blood_type,
            "height": height_value,
            "height_unit": unit_labels["height"],
            "weight": weight_value,
            "weight_unit": unit_labels["weight"],
            "gender": patient.gender,
            "address": patient.address,
            "primary_physician": (
                {
                    "name": patient.practitioner.name if patient.practitioner else None,
                    "specialty": (
                        patient.practitioner.specialty if patient.practitioner else None
                    ),
                    "practice": (
                        patient.practitioner.practice if patient.practitioner else None
                    ),
                }
                if patient.practitioner
                else None
            ),
        }

    async def _export_all_data(
        self,
        patient: Patient,
        start_date: Optional[date],
        end_date: Optional[date],
        include_files: bool = False,
        unit_system: str = "imperial",
    ) -> Dict[str, Union[Any, List[Dict[str, Any]]]]:
        """Export all patient data."""
        return {
            "medications": self._export_medications(patient, start_date, end_date),
            "lab_results": self._export_lab_results(
                patient, start_date, end_date, include_files
            ),
            "allergies": self._export_allergies(patient, start_date, end_date),
            "conditions": self._export_conditions(patient, start_date, end_date),
            "immunizations": self._export_immunizations(patient, start_date, end_date),
            "procedures": self._export_procedures(patient, start_date, end_date),
            "treatments": self._export_treatments(patient, start_date, end_date),
            "encounters": self._export_encounters(patient, start_date, end_date),
            "vitals": self._export_vitals(patient, start_date, end_date, unit_system),
            "emergency_contacts": self._export_emergency_contacts(
                patient, start_date, end_date
            ),
            "practitioners": self._export_practitioners(patient, start_date, end_date),
            "pharmacies": self._export_pharmacies(patient, start_date, end_date),
            "symptoms": self._export_symptoms(patient, start_date, end_date),
            "injuries": self._export_injuries(patient, start_date, end_date),
            "family_history": self._export_family_history(patient, start_date, end_date),
            "insurance": self._export_insurance(patient, start_date, end_date),
        }

    def _apply_date_filter(
        self, query, model, start_date: Optional[date], end_date: Optional[date]
    ):
        """Apply date filtering to a query if start_date or end_date are provided."""
        date_field = None

        # Determine the appropriate date field based on the model
        if hasattr(model, "date"):
            date_field = model.date
        elif hasattr(model, "effective_period_start"):  # Medication model
            date_field = model.effective_period_start
        elif hasattr(model, "date_administered"):  # Immunization model
            date_field = model.date_administered
        elif hasattr(model, "onset_date"):  # Condition model
            date_field = model.onset_date
        elif hasattr(model, "onset_date"):  # Allergy model
            date_field = model.onset_date
        elif hasattr(model, "ordered_date"):  # LabResult model
            date_field = model.ordered_date
        elif hasattr(model, "start_date"):  # Treatment model
            date_field = model.start_date
        elif hasattr(model, "recorded_date"):  # Vitals model
            date_field = model.recorded_date
        elif hasattr(model, "created_at"):
            date_field = model.created_at

        if date_field is None:
            return query

        if start_date:
            query = query.filter(date_field >= start_date)
        if end_date:
            query = query.filter(date_field <= end_date)
        return query

    def _export_medications(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export medications data."""
        query = (
            self.db.query(Medication)
            .options(joinedload(Medication.practitioner))
            .filter(Medication.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Medication, start_date, end_date)
        medications = query.all()

        return [
            {
                "id": med.id,
                "medication_name": med.medication_name,
                "dosage": med.dosage,
                "frequency": med.frequency,
                "route": med.route,
                "indication": med.indication,
                "start_date": (
                    med.effective_period_start.isoformat()
                    if med.effective_period_start is not None
                    else None
                ),
                "end_date": (
                    med.effective_period_end.isoformat()
                    if med.effective_period_end is not None
                    else None
                ),
                "status": med.status,
                "prescribed_by": med.practitioner.name if med.practitioner else None,
            }
            for med in medications
        ]

    def _export_lab_results(
        self,
        patient: Patient,
        start_date: Optional[date],
        end_date: Optional[date],
        include_files: bool = False,
    ) -> List[Dict[str, Any]]:
        """Export lab results data."""
        from app.models.models import LabResultFile

        query = (
            self.db.query(LabResult)
            .options(joinedload(LabResult.practitioner))
            .options(joinedload(LabResult.files))  # Include files in the query
            .filter(LabResult.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, LabResult, start_date, end_date)
        lab_results = query.all()

        results_data = []
        for result in lab_results:
            result_dict = {
                "id": result.id,
                "test_name": result.test_name,
                "test_code": result.test_code,
                "test_category": result.test_category,
                "test_type": result.test_type,
                "facility": result.facility,
                "status": result.status,
                "labs_result": result.labs_result,
                "ordered_date": (
                    result.ordered_date.isoformat()
                    if result.ordered_date is not None
                    else None
                ),
                "completed_date": (
                    result.completed_date.isoformat()
                    if result.completed_date is not None
                    else None
                ),
                "ordered_by": result.practitioner.name if result.practitioner else None,
                "notes": result.notes,
            }

            # Add file attachment information if files exist and include_files is True
            if include_files:
                if result.files:
                    file_info = []
                    for file in result.files:
                        file_info.append(
                            f"{file.file_name} ({file.file_type}, {self._format_file_size(file.file_size)})"
                        )
                    result_dict["attached_files"] = "; ".join(file_info)
                else:
                    result_dict["attached_files"] = "No files attached"

            results_data.append(result_dict)

        return results_data

    def _format_file_size(self, size_bytes: Optional[int]) -> str:
        """Format file size in human readable format."""
        if size_bytes is None or size_bytes <= 0:
            return "Unknown size"

        for unit in ["B", "KB", "MB", "GB"]:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"

    def get_lab_result_files(
        self, user_id: int, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Get all lab result files for a patient.

        Returns files with storage backend info for proper handling of local vs paperless files.
        """
        import os

        # Get the active patient for the user
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.active_patient_id:
            return []

        patient = (
            self.db.query(Patient).filter(Patient.id == user.active_patient_id).first()
        )
        if not patient:
            return []

        # Query lab results with files
        query = (
            self.db.query(LabResult)
            .options(joinedload(LabResult.files))
            .filter(LabResult.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, LabResult, start_date, end_date)
        lab_results = query.all()

        files_info = []
        for result in lab_results:
            for file in result.files:
                storage_backend = getattr(file, "storage_backend", "local") or "local"
                paperless_doc_id = getattr(file, "paperless_document_id", None)

                # For local files, verify the file exists
                if storage_backend == "local":
                    if not file.file_path or not os.path.exists(file.file_path):
                        logger.warning(
                            f"Local file not found: {file.file_path}",
                            extra={
                                "category": "app",
                                "event": "export_local_file_missing",
                                "file_id": file.id,
                                "file_path": file.file_path,
                            },
                        )
                        continue

                files_info.append(
                    {
                        "file_path": file.file_path,
                        "file_name": file.file_name,
                        "file_type": file.file_type,
                        "test_name": result.test_name,
                        "file_size": file.file_size,
                        "storage_backend": storage_backend,
                        "paperless_document_id": paperless_doc_id,
                    }
                )

        return files_info

    def _export_allergies(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export allergies data."""
        query = self.db.query(Allergy).filter(Allergy.patient_id == patient.id)
        query = self._apply_date_filter(query, Allergy, start_date, end_date)
        allergies = query.all()
        return [
            {
                "id": allergy.id,
                "allergen": allergy.allergen,
                "reaction": allergy.reaction,
                "severity": allergy.severity,
                "onset_date": (
                    allergy.onset_date.isoformat()
                    if allergy.onset_date is not None
                    else None
                ),
                "status": allergy.status,
                "notes": allergy.notes,
            }
            for allergy in allergies
        ]

    def _export_conditions(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export conditions data."""
        query = (
            self.db.query(Condition)
            .options(joinedload(Condition.practitioner))
            .filter(Condition.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Condition, start_date, end_date)
        conditions = query.all()

        return [
            {
                "id": condition.id,
                "condition_name": condition.condition_name,
                "diagnosis": condition.diagnosis,
                "status": condition.status,
                "onset_date": (
                    condition.onset_date.isoformat()
                    if condition.onset_date is not None
                    else None
                ),
                "diagnosed_by": (
                    condition.practitioner.name if condition.practitioner else None
                ),
                "notes": condition.notes,
            }
            for condition in conditions
        ]

    def _export_immunizations(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export immunizations data."""
        query = (
            self.db.query(Immunization)
            .options(joinedload(Immunization.practitioner))
            .filter(Immunization.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Immunization, start_date, end_date)
        immunizations = query.all()
        return [
            {
                "id": imm.id,
                "vaccine_name": imm.vaccine_name,
                "date_administered": (
                    imm.date_administered.isoformat()
                    if imm.date_administered is not None
                    else None
                ),
                "dose_number": imm.dose_number,
                "lot_number": imm.lot_number,
                "manufacturer": imm.manufacturer,
                "site": imm.site,
                "route": imm.route,
                "expiration_date": (
                    imm.expiration_date.isoformat()
                    if imm.expiration_date is not None
                    else None
                ),
                "administered_by": imm.practitioner.name if imm.practitioner else None,
                "notes": imm.notes,
            }
            for imm in immunizations
        ]

    def _export_procedures(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export procedures data."""
        query = (
            self.db.query(Procedure)
            .options(joinedload(Procedure.practitioner))
            .filter(Procedure.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Procedure, start_date, end_date)
        procedures = query.all()
        return [
            {
                "id": proc.id,
                "procedure_name": proc.procedure_name,
                "code": proc.procedure_code,
                "date": proc.date.isoformat() if proc.date is not None else None,
                "description": proc.description,
                "status": proc.status,
                "performed_by": proc.practitioner.name if proc.practitioner else None,
                "facility": proc.facility,
                "notes": proc.notes,
            }
            for proc in procedures
        ]

    def _export_treatments(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export treatments data."""
        query = (
            self.db.query(Treatment)
            .options(joinedload(Treatment.practitioner))
            .filter(Treatment.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Treatment, start_date, end_date)
        treatments = query.all()
        return [
            {
                "id": treatment.id,
                "treatment_name": treatment.treatment_name,
                "treatment_type": treatment.treatment_type,
                "start_date": (
                    treatment.start_date.isoformat()
                    if treatment.start_date is not None
                    else None
                ),
                "end_date": (
                    treatment.end_date.isoformat()
                    if treatment.end_date is not None
                    else None
                ),
                "status": treatment.status,
                "treatment_category": treatment.treatment_category,
                "frequency": treatment.frequency,
                "outcome": treatment.outcome,
                "description": treatment.description,
                "location": treatment.location,
                "prescribed_by": (
                    treatment.practitioner.name if treatment.practitioner else None
                ),
                "notes": treatment.notes,
            }
            for treatment in treatments
        ]

    def _export_encounters(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export encounters data."""
        query = (
            self.db.query(Encounter)
            .options(joinedload(Encounter.practitioner))
            .filter(Encounter.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Encounter, start_date, end_date)
        encounters = query.all()
        return [
            {
                "id": encounter.id,
                "date": (
                    encounter.date.isoformat() if encounter.date is not None else None
                ),
                "reason": encounter.reason,
                "practitioner": (
                    encounter.practitioner.name if encounter.practitioner else None
                ),
                "notes": encounter.notes,
            }
            for encounter in encounters
        ]

    def _export_vitals(
        self,
        patient: Patient,
        start_date: Optional[date],
        end_date: Optional[date],
        unit_system: str = "imperial",
    ) -> List[Dict[str, Any]]:
        """Export vitals data with unit conversion."""
        query = (
            self.db.query(Vitals)
            .options(joinedload(Vitals.practitioner))
            .filter(Vitals.patient_id == patient.id)
        )
        query = self._apply_date_filter(query, Vitals, start_date, end_date)
        vitals = query.all()

        # Get unit labels
        unit_labels = UnitConverter.get_unit_labels(unit_system)

        result = []
        for vital in vitals:
            # Convert measurements based on unit system
            if unit_system == "metric":
                temperature_value = UnitConverter.fahrenheit_to_celsius(
                    vital.temperature
                )
                weight_value = UnitConverter.lbs_to_kg(vital.weight)
                height_value = UnitConverter.inches_to_cm(vital.height)
                # Recalculate BMI using metric values
                bmi_value = UnitConverter.calculate_bmi(weight_value, height_value)
            else:
                temperature_value = vital.temperature
                weight_value = vital.weight
                height_value = vital.height
                bmi_value = vital.bmi

            result.append(
                {
                    "id": vital.id,
                    "recorded_date": (
                        vital.recorded_date.isoformat() if vital.recorded_date else None
                    ),
                    "systolic_bp": vital.systolic_bp,
                    "diastolic_bp": vital.diastolic_bp,
                    "heart_rate": vital.heart_rate,
                    "temperature": temperature_value,
                    "temperature_unit": unit_labels["temperature"],
                    "weight": weight_value,
                    "weight_unit": unit_labels["weight"],
                    "height": height_value,
                    "height_unit": unit_labels["height"],
                    "oxygen_saturation": vital.oxygen_saturation,
                    "respiratory_rate": vital.respiratory_rate,
                    "blood_glucose": vital.blood_glucose,
                    "bmi": bmi_value,
                    "pain_scale": vital.pain_scale,
                    "location": vital.location,
                    "device_used": vital.device_used,
                    "recorded_by": (
                        vital.practitioner.name if vital.practitioner else None
                    ),
                    "notes": vital.notes,
                }
            )

        return result

    def _export_emergency_contacts(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export emergency contacts for a patient."""
        query = (
            self.db.query(EmergencyContact)
            .filter(EmergencyContact.patient_id == patient.id)
            .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.name)
        )

        # Emergency contacts have created_at field, so we can apply date filtering
        query = self._apply_date_filter(query, EmergencyContact, start_date, end_date)
        contacts = query.all()

        return [
            {
                "id": contact.id,
                "name": contact.name,
                "relationship": contact.relationship,
                "phone_number": contact.phone_number,
                "secondary_phone": contact.secondary_phone,
                "email": contact.email,
                "is_primary": contact.is_primary,
                "is_active": contact.is_active,
                "address": contact.address,
                "notes": contact.notes,
                "created_at": (
                    contact.created_at.isoformat() if contact.created_at else None
                ),
                "updated_at": (
                    contact.updated_at.isoformat() if contact.updated_at else None
                ),
            }
            for contact in contacts
        ]

    def _export_practitioners(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export practitioners related to a patient's care."""
        # Get practitioners that are related to this patient through various associations
        practitioner_ids = set()

        # Primary care physician
        if patient.physician_id:
            practitioner_ids.add(patient.physician_id)

        # Practitioners from medications
        med_practitioners = (
            self.db.query(Medication.practitioner_id)
            .filter(
                Medication.patient_id == patient.id,
                Medication.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in med_practitioners:
            practitioner_ids.add(practitioner_id)

        # Practitioners from encounters
        encounter_practitioners = (
            self.db.query(Encounter.practitioner_id)
            .filter(
                Encounter.patient_id == patient.id,
                Encounter.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in encounter_practitioners:
            practitioner_ids.add(practitioner_id)

        # Practitioners from lab results
        lab_practitioners = (
            self.db.query(LabResult.practitioner_id)
            .filter(
                LabResult.patient_id == patient.id,
                LabResult.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in lab_practitioners:
            practitioner_ids.add(practitioner_id)

        # Get all practitioners
        if not practitioner_ids:
            return []

        practitioners = (
            self.db.query(Practitioner)
            .filter(Practitioner.id.in_(practitioner_ids))
            .order_by(Practitioner.name)
            .all()
        )

        return [
            {
                "id": practitioner.id,
                "name": practitioner.name,
                "specialty": practitioner.specialty,
                "practice": practitioner.practice,
                "phone_number": practitioner.phone_number,
                "website": practitioner.website,
                "rating": practitioner.rating,
                "is_primary_physician": practitioner.id == patient.physician_id,
            }
            for practitioner in practitioners
        ]

    def _export_pharmacies(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export pharmacies related to a patient's medications."""
        # Get pharmacies that are related to this patient through medications
        pharmacy_ids = (
            self.db.query(Medication.pharmacy_id)
            .filter(
                Medication.patient_id == patient.id, Medication.pharmacy_id.isnot(None)
            )
            .distinct()
        )

        pharmacy_id_list = [pid for (pid,) in pharmacy_ids]

        if not pharmacy_id_list:
            return []

        pharmacies = (
            self.db.query(Pharmacy)
            .filter(Pharmacy.id.in_(pharmacy_id_list))
            .order_by(Pharmacy.name)
            .all()
        )

        return [
            {
                "id": pharmacy.id,
                "name": pharmacy.name,
                "brand": pharmacy.brand,
                "street_address": pharmacy.street_address,
                "city": pharmacy.city,
                "state": pharmacy.state,
                "zip_code": pharmacy.zip_code,
                "country": pharmacy.country,
                "store_number": pharmacy.store_number,
                "phone_number": pharmacy.phone_number,
                "fax_number": pharmacy.fax_number,
                "email": pharmacy.email,
                "website": pharmacy.website,
                "hours": pharmacy.hours,
                "drive_through": pharmacy.drive_through,
                "twenty_four_hour": pharmacy.twenty_four_hour,
                "specialty_services": pharmacy.specialty_services,
                "created_at": (
                    pharmacy.created_at.isoformat() if pharmacy.created_at else None
                ),
                "updated_at": (
                    pharmacy.updated_at.isoformat() if pharmacy.updated_at else None
                ),
            }
            for pharmacy in pharmacies
        ]

    def _export_symptoms(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export symptoms data with occurrences."""
        query = (
            self.db.query(Symptom)
            .options(joinedload(Symptom.occurrences))
            .filter(Symptom.patient_id == patient.id)
        )
        if start_date:
            query = query.filter(Symptom.first_occurrence_date >= start_date)
        if end_date:
            query = query.filter(Symptom.first_occurrence_date <= end_date)

        symptoms = query.order_by(Symptom.symptom_name).all()

        logger.info(f"Successfully exported symptoms data for patient {patient.id}")

        return [
            {
                "id": symptom.id,
                "symptom_name": symptom.symptom_name,
                "category": symptom.category,
                "status": symptom.status,
                "is_chronic": symptom.is_chronic,
                "first_occurrence_date": (
                    symptom.first_occurrence_date.isoformat()
                    if symptom.first_occurrence_date
                    else None
                ),
                "last_occurrence_date": (
                    symptom.last_occurrence_date.isoformat()
                    if symptom.last_occurrence_date
                    else None
                ),
                "typical_triggers": symptom.typical_triggers,
                "general_notes": symptom.general_notes,
                "tags": symptom.tags,
                "occurrence_count": len(symptom.occurrences) if symptom.occurrences else 0,
                "occurrences": [
                    {
                        "id": occ.id,
                        "occurrence_date": (
                            occ.occurrence_date.isoformat()
                            if occ.occurrence_date
                            else None
                        ),
                        "severity": occ.severity,
                        "pain_scale": occ.pain_scale,
                        "duration": occ.duration,
                        "time_of_day": occ.time_of_day,
                        "location": occ.location,
                        "triggers": occ.triggers,
                        "relief_methods": occ.relief_methods,
                        "associated_symptoms": occ.associated_symptoms,
                        "impact_level": occ.impact_level,
                        "resolved_date": (
                            occ.resolved_date.isoformat() if occ.resolved_date else None
                        ),
                        "resolution_notes": occ.resolution_notes,
                        "notes": occ.notes,
                    }
                    for occ in (symptom.occurrences or [])
                ],
            }
            for symptom in symptoms
        ]

    def _export_injuries(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export injuries data."""
        query = (
            self.db.query(Injury)
            .options(joinedload(Injury.injury_type))
            .options(joinedload(Injury.practitioner))
            .filter(Injury.patient_id == patient.id)
        )
        if start_date:
            query = query.filter(Injury.date_of_injury >= start_date)
        if end_date:
            query = query.filter(Injury.date_of_injury <= end_date)

        injuries = query.order_by(Injury.date_of_injury.desc()).all()

        logger.info(f"Successfully exported injuries data for patient {patient.id}")

        return [
            {
                "id": injury.id,
                "injury_name": injury.injury_name,
                "injury_type": (
                    injury.injury_type.name if injury.injury_type else None
                ),
                "body_part": injury.body_part,
                "laterality": injury.laterality,
                "date_of_injury": (
                    injury.date_of_injury.isoformat()
                    if injury.date_of_injury
                    else None
                ),
                "mechanism": injury.mechanism,
                "severity": injury.severity,
                "status": injury.status,
                "treatment_received": injury.treatment_received,
                "recovery_notes": injury.recovery_notes,
                "practitioner": (
                    injury.practitioner.name if injury.practitioner else None
                ),
                "notes": injury.notes,
                "tags": injury.tags,
            }
            for injury in injuries
        ]

    def _export_family_history(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export family history data (family members and their conditions)."""
        query = (
            self.db.query(FamilyMember)
            .options(joinedload(FamilyMember.family_conditions))
            .filter(FamilyMember.patient_id == patient.id)
            .order_by(FamilyMember.relationship, FamilyMember.name)
        )
        if start_date:
            query = query.filter(FamilyMember.created_at >= start_date)
        if end_date:
            query = query.filter(FamilyMember.created_at <= end_date)

        family_members = query.all()

        logger.info(f"Successfully exported family_history data for patient {patient.id}")

        return [
            {
                "id": member.id,
                "name": member.name,
                "relationship": member.relationship,
                "gender": member.gender,
                "birth_year": member.birth_year,
                "death_year": member.death_year,
                "is_deceased": member.is_deceased,
                "notes": member.notes,
                "conditions": [
                    {
                        "id": condition.id,
                        "condition_name": condition.condition_name,
                        "diagnosis_age": condition.diagnosis_age,
                        "severity": condition.severity,
                        "status": condition.status,
                        "condition_type": condition.condition_type,
                        "icd10_code": condition.icd10_code,
                        "notes": condition.notes,
                    }
                    for condition in (member.family_conditions or [])
                ],
            }
            for member in family_members
        ]

    def _export_insurance(
        self, patient: Patient, start_date: Optional[date], end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Export insurance data."""
        query = (
            self.db.query(Insurance)
            .filter(Insurance.patient_id == patient.id)
            .order_by(Insurance.is_primary.desc(), Insurance.insurance_type)
        )
        if start_date:
            query = query.filter(Insurance.effective_date >= start_date)
        if end_date:
            query = query.filter(Insurance.effective_date <= end_date)

        insurances = query.all()

        logger.info(f"Successfully exported insurance data for patient {patient.id}")

        return [
            {
                "id": insurance.id,
                "insurance_type": insurance.insurance_type,
                "company_name": insurance.company_name,
                "employer_group": insurance.employer_group,
                "member_name": insurance.member_name,
                "member_id": insurance.member_id,
                "group_number": insurance.group_number,
                "plan_name": insurance.plan_name,
                "policy_holder_name": insurance.policy_holder_name,
                "relationship_to_holder": insurance.relationship_to_holder,
                "effective_date": (
                    insurance.effective_date.isoformat()
                    if insurance.effective_date
                    else None
                ),
                "expiration_date": (
                    insurance.expiration_date.isoformat()
                    if insurance.expiration_date
                    else None
                ),
                "status": insurance.status,
                "is_primary": insurance.is_primary,
                "coverage_details": insurance.coverage_details,
                "contact_info": insurance.contact_info,
                "notes": insurance.notes,
            }
            for insurance in insurances
        ]

    async def get_export_summary(self, user_id: int) -> Dict[str, Any]:
        """Get summary of available data for export using active patient."""
        # Get the active patient for the user
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        if not user.active_patient_id:
            raise ValueError("No active patient selected")

        patient = (
            self.db.query(Patient).filter(Patient.id == user.active_patient_id).first()
        )
        if not patient:
            raise ValueError("Active patient record not found")

        return await self.get_export_summary_by_patient_id(patient.id)

    async def get_export_summary_by_patient_id(self, patient_id: int) -> Dict[str, Any]:
        """Get summary of available data for export by patient ID (Phase 1 compatible)."""
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError("Patient record not found")

        return {
            "patient_id": patient.id,
            "counts": {
                "medications": self.db.query(Medication)
                .filter(Medication.patient_id == patient.id)
                .count(),
                "lab_results": self.db.query(LabResult)
                .filter(LabResult.patient_id == patient.id)
                .count(),
                "allergies": self.db.query(Allergy)
                .filter(Allergy.patient_id == patient.id)
                .count(),
                "conditions": self.db.query(Condition)
                .filter(Condition.patient_id == patient.id)
                .count(),
                "immunizations": self.db.query(Immunization)
                .filter(Immunization.patient_id == patient.id)
                .count(),
                "procedures": self.db.query(Procedure)
                .filter(Procedure.patient_id == patient.id)
                .count(),
                "treatments": self.db.query(Treatment)
                .filter(Treatment.patient_id == patient.id)
                .count(),
                "encounters": self.db.query(Encounter)
                .filter(Encounter.patient_id == patient.id)
                .count(),
                "vitals": self.db.query(Vitals)
                .filter(Vitals.patient_id == patient.id)
                .count(),
                "emergency_contacts": self.db.query(EmergencyContact)
                .filter(EmergencyContact.patient_id == patient.id)
                .count(),
                "practitioners": len(self._get_related_practitioner_ids(patient)),
                "pharmacies": len(self._get_related_pharmacy_ids(patient)),
                "symptoms": self.db.query(Symptom)
                .filter(Symptom.patient_id == patient.id)
                .count(),
                "injuries": self.db.query(Injury)
                .filter(Injury.patient_id == patient.id)
                .count(),
                "family_history": self.db.query(FamilyMember)
                .filter(FamilyMember.patient_id == patient.id)
                .count(),
                "insurance": self.db.query(Insurance)
                .filter(Insurance.patient_id == patient.id)
                .count(),
            },
        }

    def _get_related_practitioner_ids(self, patient: Patient) -> List[int]:
        """Get all practitioner IDs related to a patient."""
        practitioner_ids = set()

        # Primary care physician
        if patient.physician_id:
            practitioner_ids.add(patient.physician_id)

        # Practitioners from medications
        med_practitioners = (
            self.db.query(Medication.practitioner_id)
            .filter(
                Medication.patient_id == patient.id,
                Medication.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in med_practitioners:
            practitioner_ids.add(practitioner_id)

        # Practitioners from encounters
        encounter_practitioners = (
            self.db.query(Encounter.practitioner_id)
            .filter(
                Encounter.patient_id == patient.id,
                Encounter.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in encounter_practitioners:
            practitioner_ids.add(practitioner_id)

        # Practitioners from lab results
        lab_practitioners = (
            self.db.query(LabResult.practitioner_id)
            .filter(
                LabResult.patient_id == patient.id,
                LabResult.practitioner_id.isnot(None),
            )
            .distinct()
        )
        for (practitioner_id,) in lab_practitioners:
            practitioner_ids.add(practitioner_id)

        return list(practitioner_ids)

    def _get_related_pharmacy_ids(self, patient: Patient) -> List[int]:
        """Get all pharmacy IDs related to a patient."""
        pharmacy_ids = (
            self.db.query(Medication.pharmacy_id)
            .filter(
                Medication.patient_id == patient.id, Medication.pharmacy_id.isnot(None)
            )
            .distinct()
        )
        return [pid for (pid,) in pharmacy_ids]

    def convert_to_csv(self, export_data: Dict[str, Any], scope: str) -> str:
        """Convert export data to CSV format with clean formatting."""
        output = io.StringIO()

        # Add patient info header if available
        if "patient_info" in export_data:
            patient_info = export_data["patient_info"]
            height_unit = patient_info.get("height_unit", "inches")
            weight_unit = patient_info.get("weight_unit", "lbs")

            output.write("# PATIENT INFORMATION\n")
            output.write(
                f"# Name: {patient_info.get('first_name', '')} {patient_info.get('last_name', '')}\n"
            )
            output.write(f"# Birth Date: {patient_info.get('birth_date', '')}\n")
            output.write(f"# Blood Type: {patient_info.get('blood_type', '')}\n")
            if patient_info.get("height"):
                output.write(f"# Height: {patient_info.get('height')} {height_unit}\n")
            if patient_info.get("weight"):
                output.write(f"# Weight: {patient_info.get('weight')} {weight_unit}\n")
            output.write("\n")

        if scope == "all":
            # For "all" scope, create separate sections for each data type
            for data_type, records in export_data.items():
                if data_type in ["patient_info", "export_metadata"]:
                    continue
                if records and isinstance(records, list) and len(records) > 0:
                    output.write(f"# {data_type.upper().replace('_', ' ')}\n")
                    self._write_csv_section(output, records)
                    output.write("\n")
        else:
            # For specific scope, write the relevant data
            data_key = scope
            if data_key in export_data and export_data[data_key]:
                records = export_data[data_key]
                if isinstance(records, list) and len(records) > 0:
                    # Add a header comment for the data type
                    output.write(f"# {scope.upper().replace('_', ' ')} DATA\n")
                    self._write_csv_section(output, records)
                else:
                    output.write(f"# No {scope.replace('_', ' ')} data found\n")
            else:
                output.write(f"# No {scope.replace('_', ' ')} data found\n")

        return output.getvalue()

    def _format_csv_value(self, field_name: str, value: Any) -> str:
        """Format a value for CSV output with human-readable formatting."""
        if value is None or value == "":
            return ""

        # Format nested conditions (for family history)
        if field_name == "conditions" and isinstance(value, list):
            if not value:
                return "None recorded"
            condition_strs = []
            for cond in value:
                if isinstance(cond, dict):
                    name = cond.get("condition_name", "Unknown")
                    age = cond.get("diagnosis_age")
                    severity = cond.get("severity", "")
                    if age:
                        if severity:
                            condition_strs.append(f"{name} (age {age}, {severity})")
                        else:
                            condition_strs.append(f"{name} (age {age})")
                    else:
                        if severity:
                            condition_strs.append(f"{name} ({severity})")
                        else:
                            condition_strs.append(name)
            return "; ".join(condition_strs)

        # Format nested occurrences (for symptoms)
        if field_name == "occurrences" and isinstance(value, list):
            if not value:
                return "None recorded"
            return f"{len(value)} occurrence(s) recorded"

        # Format dates (remove timestamps)
        if field_name in [
            "start_date",
            "end_date",
            "ordered_date",
            "completed_date",
            "date_administered",
            "onset_date",
            "recorded_date",
            "date",
            "created_at",
            "updated_at",
            "first_occurrence_date",
            "last_occurrence_date",
            "date_of_injury",
            "effective_date",
            "expiration_date",
            "resolved_date",
        ]:
            str_value = str(value)
            if "T" in str_value:
                return str_value.split("T")[0]
            elif len(str_value) > 10 and ":" in str_value:
                return str_value.split(" ")[0]

        # Format boolean values
        if field_name in [
            "is_primary",
            "is_active",
            "is_primary_physician",
            "drive_through",
            "twenty_four_hour",
            "is_chronic",
            "is_deceased",
        ]:
            if isinstance(value, bool):
                return "Yes" if value else "No"
            elif str(value).lower() in ["true", "false"]:
                return "Yes" if str(value).lower() == "true" else "No"

        # Format other lists/dicts as JSON
        if isinstance(value, (list, dict)):
            return json.dumps(value)

        return str(value)

    def _write_csv_section(self, output: io.StringIO, records: List[Dict[str, Any]]):
        """Write a section of data to CSV with proper formatting."""
        if not records:
            return

        # Get all possible fieldnames from all records to handle inconsistent data
        fieldnames = set()
        for record in records:
            fieldnames.update(record.keys())
        fieldnames = sorted(list(fieldnames))

        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        # Write each record, handling missing fields gracefully
        for record in records:
            # Ensure all values are formatted properly
            clean_record = {}
            for field in fieldnames:
                value = record.get(field)
                clean_record[field] = self._format_csv_value(field, value)
            writer.writerow(clean_record)

    async def convert_to_pdf(
        self, export_data: Dict[str, Any], include_files: bool = False
    ) -> bytes:
        """Convert export data to PDF format."""
        try:
            logger.info(
                f"Starting PDF generation for data with keys: {list(export_data.keys())}"
            )

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18,
            )
            styles = getSampleStyleSheet()
            story = []

            # Title
            title_style = ParagraphStyle(
                "CustomTitle",
                parent=styles["Heading1"],
                fontSize=18,
                spaceAfter=30,
                alignment=1,  # Center alignment
            )
            story.append(Paragraph("Medical Records Export", title_style))
            story.append(Spacer(1, 12))

            # Patient Info
            if "patient_info" in export_data:
                story.append(Paragraph("Patient Information", styles["Heading2"]))
                patient_info = export_data["patient_info"]

                # Create patient info table with safe data handling
                # Use unit labels from patient_info if available, otherwise default to imperial
                height_unit = patient_info.get("height_unit", "inches")
                weight_unit = patient_info.get("weight_unit", "lbs")

                patient_data = [
                    [
                        "Name",
                        f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip(),
                    ],
                    ["Birth Date", str(patient_info.get("birth_date", "N/A"))],
                    ["Blood Type", str(patient_info.get("blood_type", "N/A"))],
                    [
                        "Height",
                        (
                            f"{patient_info.get('height', 'N/A')} {height_unit}"
                            if patient_info.get("height")
                            else "N/A"
                        ),
                    ],
                    [
                        "Weight",
                        (
                            f"{patient_info.get('weight', 'N/A')} {weight_unit}"
                            if patient_info.get("weight")
                            else "N/A"
                        ),
                    ],
                    ["Gender", str(patient_info.get("gender", "N/A"))],
                ]

                patient_table = Table(patient_data, colWidths=[2 * inch, 4 * inch])
                patient_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (0, -1), colors.grey),
                            ("TEXTCOLOR", (0, 0), (0, -1), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                            ("FONTSIZE", (0, 0), (-1, -1), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                            ("BACKGROUND", (1, 0), (-1, -1), colors.beige),
                            ("GRID", (0, 0), (-1, -1), 1, colors.black),
                        ]
                    )
                )
                story.append(patient_table)
                story.append(Spacer(1, 20))

            # Add each data section
            for section_name, section_data in export_data.items():
                if (
                    section_name in ["patient_info", "export_metadata"]
                    or not section_data
                ):
                    continue

                # Add section heading with modern styling
                section_title = section_name.replace("_", " ").title()

                # Create a modern section header style
                section_header_style = ParagraphStyle(
                    "SectionHeader",
                    parent=styles["Heading2"],
                    fontSize=14,
                    fontName="Helvetica-Bold",
                    textColor=colors.Color(0.2, 0.4, 0.6),  # Professional blue
                    spaceAfter=16,
                    spaceBefore=20,
                    borderWidth=0,
                    borderColor=colors.Color(0.3, 0.5, 0.7),
                    borderPadding=0,
                    leftIndent=0,
                    backColor=None,
                )
                story.append(Paragraph(section_title, section_header_style))

                if isinstance(section_data, list) and len(section_data) > 0:
                    # Use card-based format for better readability with long text fields
                    self._add_card_based_section(
                        story, section_data, section_name, styles
                    )

                else:
                    story.append(Paragraph("No data available", styles["Normal"]))

                story.append(Spacer(1, 20))

            # Export metadata
            if "export_metadata" in export_data:
                story.append(Paragraph("Export Information", styles["Heading2"]))
                metadata = export_data["export_metadata"]
                story.append(
                    Paragraph(
                        f"Generated: {metadata.get('generated_at', 'N/A')}",
                        styles["Normal"],
                    )
                )
                story.append(
                    Paragraph(
                        f"Format: {metadata.get('format', 'N/A')}", styles["Normal"]
                    )
                )
                story.append(
                    Paragraph(
                        f"Scope: {metadata.get('scope', 'N/A')}", styles["Normal"]
                    )
                )

                if metadata.get("date_range", {}).get("start") or metadata.get(
                    "date_range", {}
                ).get("end"):
                    date_range = metadata.get("date_range", {})
                    start_date = date_range.get("start", "N/A")
                    end_date = date_range.get("end", "N/A")
                    story.append(
                        Paragraph(
                            f"Date Range: {start_date} to {end_date}", styles["Normal"]
                        )
                    )

                if metadata.get("include_files"):
                    story.append(
                        Paragraph(
                            "File Attachments: Included (see lab results)",
                            styles["Normal"],
                        )
                    )
                else:
                    story.append(
                        Paragraph("File Attachments: Not included", styles["Normal"])
                    )

            # Build the PDF document
            doc.build(story)

            # Get the PDF bytes
            pdf_bytes = buffer.getvalue()
            buffer.close()

            logger.info(f"PDF generated successfully, size: {len(pdf_bytes)} bytes")
            return pdf_bytes

        except Exception as e:
            logger.error(f"PDF generation error: {str(e)}")
            # Create a simple error PDF
            error_buffer = io.BytesIO()
            error_doc = SimpleDocTemplate(error_buffer, pagesize=A4)
            error_story = [
                Paragraph("PDF Generation Error", getSampleStyleSheet()["Heading1"]),
                Spacer(1, 12),
                Paragraph(
                    f"An error occurred while generating the PDF: {str(e)}",
                    getSampleStyleSheet()["Normal"],
                ),
                Spacer(1, 12),
                Paragraph(
                    "Please try exporting in JSON or CSV format instead.",
                    getSampleStyleSheet()["Normal"],
                ),
            ]
            error_doc.build(error_story)
            error_pdf_bytes = error_buffer.getvalue()
            error_buffer.close()
            return error_pdf_bytes

    def _add_card_based_section(self, story, section_data, section_name, styles):
        """Add a section using card-based format instead of tables for better readability."""
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, Table, TableStyle
        from reportlab.lib.styles import ParagraphStyle

        # Create styles for wrapping text in table cells
        cell_value_style = ParagraphStyle(
            "CellValue",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.Color(0.1, 0.1, 0.1),
        )
        cell_label_style = ParagraphStyle(
            "CellLabel",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            fontName="Helvetica-Bold",
            textColor=colors.white,
            alignment=2,  # Right align
        )

        # Create user-friendly field names
        header_mapping = {
            "id": "ID",
            "medication_name": "Medication",
            "dosage": "Dosage",
            "frequency": "Frequency",
            "route": "Route",
            "indication": "Indication",
            "start_date": "Start Date",
            "end_date": "End Date",
            "status": "Status",
            "prescribed_by": "Prescribed By",
            "test_name": "Test Name",
            "test_code": "Code",
            "test_category": "Category",
            "test_type": "Type",
            "facility": "Facility",
            "labs_result": "Result",
            "ordered_date": "Ordered",
            "completed_date": "Completed",
            "ordered_by": "Ordered By",
            "allergen": "Allergen",
            "reaction": "Reaction",
            "severity": "Severity",
            "onset_date": "Onset Date",
            "condition_name": "Condition",
            "diagnosis": "Diagnosis",
            "onset_date": "Onset Date",
            "diagnosed_by": "Diagnosed By",
            "vaccine_name": "Vaccine",
            "date_administered": "Date Given",
            "dose_number": "Dose #",
            "lot_number": "Lot #",
            "manufacturer": "Manufacturer",
            "site": "Site",
            "expiration_date": "Expires",
            "administered_by": "Given By",
            "procedure_name": "Procedure",
            "code": "Code",
            "date": "Date",
            "description": "Description",
            "performed_by": "Performed By",
            "treatment_name": "Treatment",
            "treatment_type": "Type",
            "treatment_category": "Category",
            "outcome": "Outcome",
            "location": "Location",
            "reason": "Reason",
            "practitioner": "Practitioner",
            "recorded_date": "Recorded",
            "systolic_bp": "Systolic BP",
            "diastolic_bp": "Diastolic BP",
            "heart_rate": "Heart Rate",
            "temperature": "Temperature",
            "weight": "Weight",
            "height": "Height",
            "oxygen_saturation": "O2 Saturation",
            "respiratory_rate": "Respiratory Rate",
            "blood_glucose": "Blood Glucose",
            "bmi": "BMI",
            "pain_scale": "Pain Scale",
            "device_used": "Device Used",
            "recorded_by": "Recorded By",
            "notes": "Notes",
            "attached_files": "Attached Files",
            # Emergency contacts
            "name": "Name",
            "relationship": "Relationship",
            "phone_number": "Phone Number",
            "secondary_phone": "Secondary Phone",
            "email": "Email",
            "is_primary": "Primary Contact",
            "is_active": "Active",
            "address": "Address",
            # Practitioners
            "specialty": "Specialty",
            "practice": "Practice",
            "website": "Website",
            "rating": "Rating",
            "is_primary_physician": "Primary Physician",
            # Pharmacies
            "brand": "Brand",
            "street_address": "Street Address",
            "city": "City",
            "state": "State",
            "zip_code": "ZIP Code",
            "country": "Country",
            "store_number": "Store Number",
            "fax_number": "Fax Number",
            "hours": "Hours",
            "drive_through": "Drive Through",
            "twenty_four_hour": "24 Hour Service",
            "specialty_services": "Specialty Services",
            # Symptoms
            "symptom_name": "Symptom",
            "category": "Category",
            "is_chronic": "Chronic",
            "first_occurrence_date": "First Occurrence",
            "last_occurrence_date": "Last Occurrence",
            "typical_triggers": "Typical Triggers",
            "general_notes": "General Notes",
            "occurrence_count": "Occurrence Count",
            "occurrences": "Occurrences",
            # Injuries
            "injury_name": "Injury",
            "injury_type": "Type",
            "body_part": "Body Part",
            "laterality": "Laterality",
            "date_of_injury": "Date of Injury",
            "mechanism": "Mechanism",
            "treatment_received": "Treatment Received",
            "recovery_notes": "Recovery Notes",
            # Family History
            "gender": "Gender",
            "birth_year": "Birth Year",
            "death_year": "Death Year",
            "is_deceased": "Deceased",
            "conditions": "Conditions",
            "diagnosis_age": "Diagnosis Age",
            "condition_type": "Condition Type",
            "icd10_code": "ICD-10 Code",
            # Insurance
            "insurance_type": "Insurance Type",
            "company_name": "Company",
            "employer_group": "Employer/Group",
            "member_name": "Member Name",
            "member_id": "Member ID",
            "group_number": "Group Number",
            "plan_name": "Plan Name",
            "policy_holder_name": "Policy Holder",
            "relationship_to_holder": "Relationship",
            "effective_date": "Effective Date",
            "expiration_date": "Expiration Date",
            "coverage_details": "Coverage Details",
            "contact_info": "Contact Info",
        }

        def format_value(field_name, value):
            """Format field values for better display."""
            if value is None or value == "":
                return "N/A"

            str_value = str(value)

            # Format dates (remove timestamps)
            if field_name in [
                "start_date",
                "end_date",
                "ordered_date",
                "completed_date",
                "date_administered",
                "onset_date",
                "recorded_date",
                "date",
                "onset_date",
                "created_at",
                "updated_at",
                "first_occurrence_date",
                "last_occurrence_date",
                "date_of_injury",
                "effective_date",
                "expiration_date",
                "resolved_date",
            ]:
                if "T" in str_value:
                    return str_value.split("T")[0]
                elif len(str_value) > 10 and ":" in str_value:
                    return str_value.split(" ")[0]

            # Format boolean values
            if field_name in [
                "is_primary",
                "is_active",
                "is_primary_physician",
                "drive_through",
                "twenty_four_hour",
                "is_chronic",
                "is_deceased",
            ]:
                if isinstance(value, bool):
                    return "Yes" if value else "No"
                elif str_value.lower() in ["true", "false"]:
                    return "Yes" if str_value.lower() == "true" else "No"

            # Format rating
            if field_name == "rating" and value is not None:
                try:
                    rating_num = float(value)
                    return f"{rating_num:.1f}/5.0"
                except (ValueError, TypeError):
                    pass

            # Format nested conditions (for family history)
            if field_name == "conditions" and isinstance(value, list):
                if not value:
                    return "None recorded"
                condition_strs = []
                for cond in value:
                    if isinstance(cond, dict):
                        name = cond.get("condition_name", "Unknown")
                        age = cond.get("diagnosis_age")
                        severity = cond.get("severity", "")
                        if age:
                            condition_strs.append(f"• {name} (age {age}, {severity})" if severity else f"• {name} (age {age})")
                        else:
                            condition_strs.append(f"• {name} ({severity})" if severity else f"• {name}")
                return "\n".join(condition_strs)

            # Format nested occurrences (for symptoms)
            if field_name == "occurrences" and isinstance(value, list):
                if not value:
                    return "None recorded"
                return f"{len(value)} occurrence(s) recorded"

            return str_value

        # Limit to 50 records per section
        for i, record in enumerate(section_data[:50]):
            if i > 0:
                story.append(Spacer(1, 12))  # Space between cards

            # Create card data - organize fields in a logical order
            card_data = []

            # Define field order for different record types
            if section_name == "medications":
                field_order = [
                    "medication_name",
                    "dosage",
                    "frequency",
                    "route",
                    "indication",
                    "start_date",
                    "end_date",
                    "status",
                    "prescribed_by",
                    "notes",
                ]
            elif section_name == "lab_results":
                field_order = [
                    "test_name",
                    "test_code",
                    "test_category",
                    "test_type",
                    "facility",
                    "labs_result",
                    "ordered_date",
                    "completed_date",
                    "ordered_by",
                    "status",
                    "attached_files",
                    "notes",
                ]
            elif section_name == "allergies":
                field_order = [
                    "allergen",
                    "reaction",
                    "severity",
                    "onset_date",
                    "status",
                    "notes",
                ]
            elif section_name == "conditions":
                field_order = [
                    "condition_name",
                    "diagnosis",
                    "onset_date",
                    "status",
                    "diagnosed_by",
                    "notes",
                ]
            elif section_name == "vitals":
                field_order = [
                    "recorded_date",
                    "systolic_bp",
                    "diastolic_bp",
                    "heart_rate",
                    "temperature",
                    "weight",
                    "height",
                    "oxygen_saturation",
                    "respiratory_rate",
                    "blood_glucose",
                    "bmi",
                    "pain_scale",
                    "device_used",
                    "location",
                    "recorded_by",
                    "notes",
                ]
            elif section_name == "symptoms":
                field_order = [
                    "symptom_name",
                    "category",
                    "status",
                    "is_chronic",
                    "first_occurrence_date",
                    "last_occurrence_date",
                    "occurrence_count",
                    "typical_triggers",
                    "general_notes",
                    "tags",
                ]
            elif section_name == "injuries":
                field_order = [
                    "injury_name",
                    "injury_type",
                    "body_part",
                    "laterality",
                    "date_of_injury",
                    "mechanism",
                    "severity",
                    "status",
                    "treatment_received",
                    "recovery_notes",
                    "practitioner",
                    "notes",
                    "tags",
                ]
            elif section_name == "family_history":
                field_order = [
                    "name",
                    "relationship",
                    "gender",
                    "birth_year",
                    "death_year",
                    "is_deceased",
                    "conditions",
                    "notes",
                ]
            elif section_name == "insurance":
                field_order = [
                    "insurance_type",
                    "company_name",
                    "plan_name",
                    "member_name",
                    "member_id",
                    "group_number",
                    "policy_holder_name",
                    "relationship_to_holder",
                    "effective_date",
                    "expiration_date",
                    "status",
                    "is_primary",
                    "employer_group",
                    "coverage_details",
                    "contact_info",
                    "notes",
                ]
            else:
                # Default order - use all available fields
                field_order = list(record.keys())

            # Add fields to card in order
            for field_name in field_order:
                if field_name in record:
                    display_name = header_mapping.get(
                        field_name, field_name.replace("_", " ").title()
                    )
                    formatted_value = format_value(field_name, record[field_name])

                    if formatted_value != "N/A":  # Only show fields with values
                        # Use Paragraph for values that need text wrapping
                        # Convert newlines to <br/> tags for proper PDF rendering
                        if "\n" in formatted_value or len(formatted_value) > 50:
                            # Escape any HTML-like characters and convert newlines
                            escaped_value = (
                                formatted_value.replace("&", "&amp;")
                                .replace("<", "&lt;")
                                .replace(">", "&gt;")
                                .replace("\n", "<br/>")
                            )
                            value_paragraph = Paragraph(escaped_value, cell_value_style)
                            label_paragraph = Paragraph(
                                f"{display_name}:", cell_label_style
                            )
                            card_data.append([label_paragraph, value_paragraph])
                        else:
                            card_data.append([f"{display_name}:", formatted_value])

            # Create the card as a table with label-value pairs
            if card_data:
                card_table = Table(card_data, colWidths=[2.2 * inch, 4.3 * inch])

                # Define modern medical color scheme
                label_bg_color = colors.Color(0.2, 0.4, 0.6)  # Professional blue
                value_bg_color = colors.Color(0.95, 0.97, 1.0)  # Very light blue
                border_color = colors.Color(0.3, 0.5, 0.7)  # Darker blue for borders
                text_color = colors.white  # White text on blue background
                value_text_color = colors.Color(0.1, 0.1, 0.1)  # Dark gray for values

                card_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (0, -1), label_bg_color),
                            ("BACKGROUND", (1, 0), (1, -1), value_bg_color),
                            ("TEXTCOLOR", (0, 0), (0, -1), text_color),
                            ("TEXTCOLOR", (1, 0), (1, -1), value_text_color),
                            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                            ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                            ("ALIGN", (1, 0), (1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 8),
                            ("LEFTPADDING", (0, 0), (0, -1), 12),
                            ("RIGHTPADDING", (0, 0), (0, -1), 8),
                            ("LEFTPADDING", (1, 0), (1, -1), 12),
                            ("RIGHTPADDING", (1, 0), (1, -1), 8),
                            ("GRID", (0, 0), (-1, -1), 1.5, border_color),
                            (
                                "LINEBELOW",
                                (0, -1),
                                (-1, -1),
                                3,
                                border_color,
                            ),  # Thicker bottom border
                            (
                                "LINEBEFORE",
                                (0, 0),
                                (0, -1),
                                3,
                                border_color,
                            ),  # Thicker left border
                            (
                                "LINEAFTER",
                                (-1, 0),
                                (-1, -1),
                                3,
                                border_color,
                            ),  # Thicker right border
                            (
                                "LINEABOVE",
                                (0, 0),
                                (-1, 0),
                                3,
                                border_color,
                            ),  # Thicker top border
                        ]
                    )
                )
                story.append(card_table)

        # Add note if data was truncated
        if len(section_data) > 50:
            story.append(Spacer(1, 12))
            story.append(
                Paragraph(
                    f"Note: Showing first 50 of {len(section_data)} records. For complete data, use CSV export.",
                    styles["Italic"],
                )
            )
