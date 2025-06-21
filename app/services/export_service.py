"""
Export Service for Medical Records

This service handles the business logic for exporting patient medical data
in various formats including JSON, CSV, and PDF.
"""

from sqlalchemy.orm import Session, joinedload
from typing import Dict, Any, Optional, List
from datetime import datetime, date
import csv
import io
import json
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from app.models.models import (
    Patient, Medication, LabResult, Allergy, Condition,
    Immunization, Procedure, Treatment, Encounter, Vitals
)
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


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
        include_files: bool = False
    ) -> Dict[str, Any]:
        """
        Export patient data based on specified parameters.
        
        Args:
            user_id: ID of the user requesting export
            format: Export format (json, csv, pdf)
            scope: Data scope (all, medications, lab_results, etc.)
            start_date: Filter records from this date
            end_date: Filter records up to this date
            include_files: Whether to include file attachments
            
        Returns:
            Dictionary containing exported data
        """
        try:
            # Get patient record
            patient = self.db.query(Patient).filter(Patient.user_id == user_id).first()
            if not patient:
                raise ValueError("Patient record not found")
            
            export_data = {
                "patient_info": self._get_patient_info(patient),
                "export_metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "format": "json",  # Service always returns JSON data
                    "scope": scope,
                    "date_range": {
                        "start": start_date.isoformat() if start_date else None,
                        "end": end_date.isoformat() if end_date else None
                    }
                }
            }
            
            # Export based on scope
            if scope == "all":
                export_data.update(await self._export_all_data(patient, start_date, end_date))
            elif scope == "medications":
                medications_data = self._export_medications(patient, start_date, end_date)
                export_data["medications"] = medications_data
                logger.info(f"Medications export: found {len(medications_data)} records")
                if medications_data:
                    logger.info(f"First medication sample: {medications_data[0]}")
                else:
                    logger.info("No medications found for export")
            elif scope == "lab_results":
                export_data["lab_results"] = self._export_lab_results(patient, start_date, end_date)
            elif scope == "allergies":
                export_data["allergies"] = self._export_allergies(patient, start_date, end_date)
            elif scope == "conditions":
                export_data["conditions"] = self._export_conditions(patient, start_date, end_date)
            elif scope == "immunizations":
                export_data["immunizations"] = self._export_immunizations(patient, start_date, end_date)
            elif scope == "procedures":
                export_data["procedures"] = self._export_procedures(patient, start_date, end_date)
            elif scope == "treatments":
                export_data["treatments"] = self._export_treatments(patient, start_date, end_date)
            elif scope == "encounters":
                export_data["encounters"] = self._export_encounters(patient, start_date, end_date)
            elif scope == "vitals":
                export_data["vitals"] = self._export_vitals(patient, start_date, end_date)
            else:
                raise ValueError(f"Unsupported export scope: {scope}")
            
            logger.info(f"Successfully exported {scope} data for patient {patient.id}")
            
            # Always return the dictionary data - let the API endpoint handle format conversion
            return export_data
            
        except Exception as e:
            logger.error(f"Export failed for user {user_id}: {str(e)}")
            raise
    def _get_patient_info(self, patient: Patient) -> Dict[str, Any]:
        """Get basic patient information."""
        return {
            "id": patient.id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "birth_date": patient.birthDate.isoformat() if patient.birthDate is not None else None,
            "blood_type": patient.bloodType,
            "height": patient.height,
            "weight": patient.weight,
            "gender": patient.gender,
            "address": patient.address,
            "primary_physician": {
                "name": patient.practitioner.name if patient.practitioner else None,
                "specialty": patient.practitioner.specialty if patient.practitioner else None,
                "practice": patient.practitioner.practice if patient.practitioner else None,
            } if patient.practitioner else None
        }
    
    async def _export_all_data(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> Dict[str, Any]:
        """Export all patient data."""
        return {
            "medications": self._export_medications(patient, start_date, end_date),
            "lab_results": self._export_lab_results(patient, start_date, end_date),
            "allergies": self._export_allergies(patient, start_date, end_date),
            "conditions": self._export_conditions(patient, start_date, end_date),
            "immunizations": self._export_immunizations(patient, start_date, end_date),
            "procedures": self._export_procedures(patient, start_date, end_date),
            "treatments": self._export_treatments(patient, start_date, end_date),
            "encounters": self._export_encounters(patient, start_date, end_date),
            "vitals": self._export_vitals(patient, start_date, end_date),
        }

    def _apply_date_filter(self, query, model, start_date: Optional[date], end_date: Optional[date]):
        """Apply date filtering to a query if start_date or end_date are provided."""
        date_field = None
        
        # Determine the appropriate date field based on the model
        if hasattr(model, 'date'):
            date_field = model.date
        elif hasattr(model, 'effectivePeriod_start'):  # Medication model
            date_field = model.effectivePeriod_start
        elif hasattr(model, 'date_administered'):  # Immunization model
            date_field = model.date_administered
        elif hasattr(model, 'onsetDate'):  # Condition model
            date_field = model.onsetDate
        elif hasattr(model, 'onset_date'):  # Allergy model
            date_field = model.onset_date
        elif hasattr(model, 'ordered_date'):  # LabResult model
            date_field = model.ordered_date
        elif hasattr(model, 'start_date'):  # Treatment model
            date_field = model.start_date
        elif hasattr(model, 'recorded_date'):  # Vitals model
            date_field = model.recorded_date
        elif hasattr(model, 'created_at'):
            date_field = model.created_at
        
        if date_field is None:
            return query
        
        if start_date:
            query = query.filter(date_field >= start_date)
        if end_date:
            query = query.filter(date_field <= end_date)
        return query
    def _export_medications(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export medications data."""
        query = self.db.query(Medication).options(joinedload(Medication.practitioner)).filter(Medication.patient_id == patient.id)
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
                "start_date": med.effectivePeriod_start.isoformat() if med.effectivePeriod_start is not None else None,
                "end_date": med.effectivePeriod_end.isoformat() if med.effectivePeriod_end is not None else None,
                "status": med.status,
                "prescribed_by": med.practitioner.name if med.practitioner else None
            }
            for med in medications
        ]    
    def _export_lab_results(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export lab results data."""
        query = self.db.query(LabResult).options(joinedload(LabResult.practitioner)).filter(LabResult.patient_id == patient.id)
        query = self._apply_date_filter(query, LabResult, start_date, end_date)
        lab_results = query.all()
        
        return [
            {
                "id": result.id,
                "test_name": result.test_name,
                "test_code": result.test_code,
                "test_category": result.test_category,
                "test_type": result.test_type,
                "facility": result.facility,
                "status": result.status,
                "labs_result": result.labs_result,
                "ordered_date": result.ordered_date.isoformat() if result.ordered_date is not None else None,
                "completed_date": result.completed_date.isoformat() if result.completed_date is not None else None,
                "ordered_by": result.practitioner.name if result.practitioner else None,
                "notes": result.notes
            }
            for result in lab_results
        ]
    
    def _export_allergies(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
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
                "onset_date": allergy.onset_date.isoformat() if allergy.onset_date is not None else None,
                "status": allergy.status,
                "notes": allergy.notes
            }
            for allergy in allergies
        ]
    
    def _export_conditions(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export conditions data."""
        query = self.db.query(Condition).options(joinedload(Condition.practitioner)).filter(Condition.patient_id == patient.id)
        query = self._apply_date_filter(query, Condition, start_date, end_date)
        conditions = query.all()
        
        return [
            {
                "id": condition.id,
                "condition_name": condition.condition_name,
                "diagnosis": condition.diagnosis,
                "status": condition.status,
                "onset_date": condition.onsetDate.isoformat() if condition.onsetDate is not None else None,
                "diagnosed_by": condition.practitioner.name if condition.practitioner else None,
                "notes": condition.notes
            }
            for condition in conditions
        ]
    
    def _export_immunizations(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export immunizations data."""
        query = self.db.query(Immunization).options(joinedload(Immunization.practitioner)).filter(Immunization.patient_id == patient.id)
        query = self._apply_date_filter(query, Immunization, start_date, end_date)
        immunizations = query.all()        
        return [
            {
                "id": imm.id,
                "vaccine_name": imm.vaccine_name,
                "date_administered": imm.date_administered.isoformat() if imm.date_administered is not None else None,
                "dose_number": imm.dose_number,
                "lot_number": imm.lot_number,
                "manufacturer": imm.manufacturer,
                "site": imm.site,
                "route": imm.route,
                "expiration_date": imm.expiration_date.isoformat() if imm.expiration_date is not None else None,
                "administered_by": imm.practitioner.name if imm.practitioner else None,
                "notes": imm.notes
            }
            for imm in immunizations
        ]
    
    def _export_procedures(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export procedures data."""
        query = self.db.query(Procedure).options(joinedload(Procedure.practitioner)).filter(Procedure.patient_id == patient.id)
        query = self._apply_date_filter(query, Procedure, start_date, end_date)
        procedures = query.all()        
        return [
            {
                "id": proc.id,
                "procedure_name": proc.procedure_name,
                "code": proc.code,
                "date": proc.date.isoformat() if proc.date is not None else None,
                "description": proc.description,
                "status": proc.status,
                "performed_by": proc.practitioner.name if proc.practitioner else None,
                "facility": proc.facility,
                "notes": proc.notes
            }
            for proc in procedures
        ]
    
    def _export_treatments(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export treatments data."""
        query = self.db.query(Treatment).options(joinedload(Treatment.practitioner)).filter(Treatment.patient_id == patient.id)
        query = self._apply_date_filter(query, Treatment, start_date, end_date)
        treatments = query.all()        
        return [
            {
                "id": treatment.id,
                "treatment_name": treatment.treatment_name,
                "treatment_type": treatment.treatment_type,
                "start_date": treatment.start_date.isoformat() if treatment.start_date is not None else None,
                "end_date": treatment.end_date.isoformat() if treatment.end_date is not None else None,
                "status": treatment.status,
                "treatment_category": treatment.treatment_category,
                "frequency": treatment.frequency,
                "outcome": treatment.outcome,
                "description": treatment.description,
                "location": treatment.location,
                "prescribed_by": treatment.practitioner.name if treatment.practitioner else None,
                "notes": treatment.notes
            }
            for treatment in treatments
        ]
    
    def _export_encounters(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export encounters data."""
        query = self.db.query(Encounter).options(joinedload(Encounter.practitioner)).filter(Encounter.patient_id == patient.id)
        query = self._apply_date_filter(query, Encounter, start_date, end_date)
        encounters = query.all()        
        return [
            {
                "id": encounter.id,
                "date": encounter.date.isoformat() if encounter.date is not None else None,
                "reason": encounter.reason,
                "practitioner": encounter.practitioner.name if encounter.practitioner else None,
                "notes": encounter.notes
            }
            for encounter in encounters
        ]
    
    def _export_vitals(self, patient: Patient, start_date: Optional[date], end_date: Optional[date]) -> List[Dict[str, Any]]:
        """Export vitals data."""
        query = self.db.query(Vitals).options(joinedload(Vitals.practitioner)).filter(Vitals.patient_id == patient.id)
        query = self._apply_date_filter(query, Vitals, start_date, end_date)
        vitals = query.all()        
        return [
            {
                "id": vital.id,
                "recorded_date": vital.recorded_date.isoformat() if vital.recorded_date else None,
                "systolic_bp": vital.systolic_bp,
                "diastolic_bp": vital.diastolic_bp,
                "heart_rate": vital.heart_rate,
                "temperature": vital.temperature,
                "weight": vital.weight,
                "height": vital.height,
                "oxygen_saturation": vital.oxygen_saturation,
                "respiratory_rate": vital.respiratory_rate,
                "blood_glucose": vital.blood_glucose,
                "bmi": vital.bmi,
                "pain_scale": vital.pain_scale,
                "location": vital.location,
                "device_used": vital.device_used,
                "recorded_by": vital.practitioner.name if vital.practitioner else None,
                "notes": vital.notes
            }
            for vital in vitals
        ]
    
    async def get_export_summary(self, user_id: int) -> Dict[str, Any]:
        """Get summary of available data for export."""
        patient = self.db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient:
            raise ValueError("Patient record not found")
        
        return {
            "patient_id": patient.id,
            "counts": {
                "medications": self.db.query(Medication).filter(Medication.patient_id == patient.id).count(),
                "lab_results": self.db.query(LabResult).filter(LabResult.patient_id == patient.id).count(),
                "allergies": self.db.query(Allergy).filter(Allergy.patient_id == patient.id).count(),
                "conditions": self.db.query(Condition).filter(Condition.patient_id == patient.id).count(),
                "immunizations": self.db.query(Immunization).filter(Immunization.patient_id == patient.id).count(),
                "procedures": self.db.query(Procedure).filter(Procedure.patient_id == patient.id).count(),
                "treatments": self.db.query(Treatment).filter(Treatment.patient_id == patient.id).count(),
                "encounters": self.db.query(Encounter).filter(Encounter.patient_id == patient.id).count(),
                "vitals": self.db.query(Vitals).filter(Vitals.patient_id == patient.id).count(),            }
        }

    def convert_to_csv(self, export_data: Dict[str, Any], scope: str) -> str:
        """Convert export data to CSV format with clean formatting."""
        output = io.StringIO()
        
        # Add patient info header if available
        if "patient_info" in export_data:
            patient_info = export_data["patient_info"]
            output.write("# PATIENT INFORMATION\n")
            output.write(f"# Name: {patient_info.get('first_name', '')} {patient_info.get('last_name', '')}\n")
            output.write(f"# Birth Date: {patient_info.get('birth_date', '')}\n")
            output.write(f"# Blood Type: {patient_info.get('blood_type', '')}\n")
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
    
    def _write_csv_section(self, output: io.StringIO, records: List[Dict[str, Any]]):
        """Write a section of data to CSV with proper formatting."""
        if not records:
            return
        
        # Get all possible fieldnames from all records to handle inconsistent data
        fieldnames = set()
        for record in records:
            fieldnames.update(record.keys())
        fieldnames = sorted(list(fieldnames))
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
          # Write each record, handling missing fields gracefully
        for record in records:
            # Ensure all values are strings and handle None values
            clean_record = {}
            for field in fieldnames:
                value = record.get(field)
                if value is None:
                    clean_record[field] = ""
                elif isinstance(value, (list, dict)):
                    clean_record[field] = json.dumps(value)
                else:
                    clean_record[field] = str(value)
            writer.writerow(clean_record)

    async def convert_to_pdf(self, export_data: Dict[str, Any], include_files: bool = False) -> bytes:
        """Convert export data to PDF format."""
        try:
            logger.info(f"Starting PDF generation for data with keys: {list(export_data.keys())}")
            
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer, 
                pagesize=A4,
                rightMargin=72, leftMargin=72,
                topMargin=72, bottomMargin=18
            )
            styles = getSampleStyleSheet()
            story = []
            
            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=18,
                spaceAfter=30,
                alignment=1  # Center alignment
            )
            story.append(Paragraph("Medical Records Export", title_style))
            story.append(Spacer(1, 12))
            
            # Patient Info
            if "patient_info" in export_data:
                story.append(Paragraph("Patient Information", styles['Heading2']))
                patient_info = export_data["patient_info"]
                
                # Create patient info table with safe data handling
                patient_data = [
                    ["Name", f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip()],
                    ["Birth Date", str(patient_info.get('birth_date', 'N/A'))],
                    ["Blood Type", str(patient_info.get('blood_type', 'N/A'))],
                    ["Height", f"{patient_info.get('height', 'N/A')} inches" if patient_info.get('height') else 'N/A'],
                    ["Weight", f"{patient_info.get('weight', 'N/A')} lbs" if patient_info.get('weight') else 'N/A'],
                    ["Gender", str(patient_info.get('gender', 'N/A'))],
                ]
                
                patient_table = Table(patient_data, colWidths=[2*inch, 4*inch])
                patient_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.grey),
                    ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                    ('BACKGROUND', (1, 0), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                story.append(patient_table)
                story.append(Spacer(1, 20))
            
            # Add each data section
            for section_name, section_data in export_data.items():
                if section_name in ["patient_info", "export_metadata"] or not section_data:
                    continue
                
                # Add section heading
                section_title = section_name.replace('_', ' ').title()
                story.append(Paragraph(section_title, styles['Heading2']))
                
                if isinstance(section_data, list) and len(section_data) > 0:
                    # Create table for this section with safe data handling
                    headers = list(section_data[0].keys())
                    
                    # Limit the number of columns to prevent table overflow
                    max_cols = 6
                    if len(headers) > max_cols:
                        headers = headers[:max_cols]
                    
                    data = [headers]
                    
                    # Add data rows with safe string conversion
                    for record in section_data[:50]:  # Limit to 50 records per section for PDF
                        row = []
                        for header in headers:
                            value = record.get(header, '')
                            if value is None:
                                row.append('')
                            elif isinstance(value, (dict, list)):
                                row.append(str(value)[:50] + '...' if len(str(value)) > 50 else str(value))
                            else:
                                str_value = str(value)
                                # Truncate long values for PDF readability
                                row.append(str_value[:50] + '...' if len(str_value) > 50 else str_value)
                        data.append(row)
                    
                    # Calculate column widths dynamically
                    available_width = 6.5 * inch  # Total available width
                    col_width = available_width / len(headers)
                    col_widths = [col_width] * len(headers)
                    
                    table = Table(data, colWidths=col_widths)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    story.append(table)
                    
                    # Add note if data was truncated
                    if len(section_data) > 50:
                        story.append(Spacer(1, 6))
                        story.append(Paragraph(f"Note: Showing first 50 of {len(section_data)} records. For complete data, use CSV export.", styles['Italic']))
                
                else:
                    story.append(Paragraph("No data available", styles['Normal']))
                
                story.append(Spacer(1, 20))
            
            # Export metadata
            if "export_metadata" in export_data:
                story.append(Paragraph("Export Information", styles['Heading2']))
                metadata = export_data["export_metadata"]
                story.append(Paragraph(f"Generated: {metadata.get('generated_at', 'N/A')}", styles['Normal']))
                story.append(Paragraph(f"Format: {metadata.get('format', 'N/A')}", styles['Normal']))
                story.append(Paragraph(f"Scope: {metadata.get('scope', 'N/A')}", styles['Normal']))
                
                if metadata.get('date_range', {}).get('start') or metadata.get('date_range', {}).get('end'):
                    date_range = metadata.get('date_range', {})
                    start_date = date_range.get('start', 'N/A')
                    end_date = date_range.get('end', 'N/A')
                    story.append(Paragraph(f"Date Range: {start_date} to {end_date}", styles['Normal']))
            
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
                Paragraph("PDF Generation Error", getSampleStyleSheet()['Heading1']),
                Spacer(1, 12),
                Paragraph(f"An error occurred while generating the PDF: {str(e)}", getSampleStyleSheet()['Normal']),
                Spacer(1, 12),
                Paragraph("Please try exporting in JSON or CSV format instead.", getSampleStyleSheet()['Normal'])
            ]
            error_doc.build(error_story)
            error_pdf_bytes = error_buffer.getvalue()
            error_buffer.close()
            return error_pdf_bytes
