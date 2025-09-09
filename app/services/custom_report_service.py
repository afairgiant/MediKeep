"""
Custom Report Generation Service

This module provides business logic for generating custom medical reports
with selective record inclusion and template management.
"""

import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.logging_config import get_logger
from app.models.models import (
    Allergy, Condition, EmergencyContact, Encounter, FamilyCondition, FamilyMember, Immunization,
    LabResult, Medication, Patient, Pharmacy, Practitioner, Procedure,
    ReportGenerationAudit, ReportTemplate, Treatment, User, Vitals
)
from app.schemas.custom_reports import (
    CategorySummary, CustomReportError, CustomReportRequest,
    DataSummaryResponse, RecordSummary, ReportTemplate as ReportTemplateSchema,
    SelectiveRecordRequest
)
from app.services.export_service import ExportService
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator

logger = get_logger(__name__, "app")


class CustomReportService:
    """Service for generating custom medical reports with selective data"""
    
    # Map category names to model classes
    CATEGORY_MODELS = {
        'medications': Medication,
        'lab_results': LabResult,
        'allergies': Allergy,
        'conditions': Condition,
        'immunizations': Immunization,
        'procedures': Procedure,
        'treatments': Treatment,
        'encounters': Encounter,
        'vitals': Vitals,
        'emergency_contacts': EmergencyContact,
        'practitioners': Practitioner,
        'pharmacies': Pharmacy,
        'family_history': FamilyMember
    }
    
    def __init__(self, db: Session):
        self.db = db
        self.export_service = ExportService(db)
        self.pdf_generator = CustomReportPDFGenerator()
        # Cache for frequently accessed summaries (5 minutes timeout)
        self._summary_cache = {}
        self._cache_timeout = 300
        logger.debug("CustomReportService initialized")
    
    async def get_data_summary_for_selection(self, user_id: int) -> DataSummaryResponse:
        """
        Get summarized data for all categories to support record selection.
        Implements caching for performance optimization.
        """
        logger.info(f"Fetching data summary for user {user_id}")
        cache_key = f"summary_{user_id}"
        now = time.time()
        
        # Check cache
        if (cache_key in self._summary_cache and 
            now - self._summary_cache[cache_key]['timestamp'] < self._cache_timeout):
            logger.debug(f"Returning cached summary for user {user_id}")
            return self._summary_cache[cache_key]['data']
        
        logger.info(f"Generating new data summary for user {user_id}")
        
        # Get patient ID for the user
        patient = self.db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient:
            logger.warning(f"No patient found for user {user_id}")
            return DataSummaryResponse(categories={}, total_records=0)
        
        logger.info(f"Found patient {patient.id} for user {user_id}")
        
        categories = {}
        total_records = 0
        
        # Generate summary for each category
        for category_name, model_class in self.CATEGORY_MODELS.items():
            try:
                category_summary = await self._get_category_summary(
                    patient.id, 
                    category_name, 
                    model_class
                )
                categories[category_name] = category_summary
                total_records += category_summary.count
                logger.debug(f"Category {category_name}: {category_summary.count} records")
            except Exception as e:
                logger.error(f"Error getting summary for {category_name}: {str(e)}", exc_info=True)
                categories[category_name] = CategorySummary(count=0, records=[])
        
        # Get last update timestamp
        last_updated = self._get_last_update_timestamp(patient.id)
        
        summary = DataSummaryResponse(
            categories=categories,
            total_records=total_records,
            last_updated=last_updated
        )
        
        # Log summary statistics
        logger.info(f"Data summary for user {user_id}: {total_records} total records across {len([c for c in categories.values() if c.count > 0])} categories with data")
        for cat_name, cat_data in categories.items():
            if cat_data.count > 0:
                logger.debug(f"  - {cat_name}: {cat_data.count} records, {len(cat_data.records)} displayed")
        
        # Update cache
        self._summary_cache[cache_key] = {
            'data': summary,
            'timestamp': now
        }
        
        return summary
    
    async def _get_category_summary(
        self, 
        patient_id: int, 
        category: str, 
        model_class
    ) -> CategorySummary:
        """Get summary for a specific category"""
        records = []
        
        # Categories that don't have patient_id (shared resources)
        shared_categories = ['practitioners', 'pharmacies']
        
        # Build base query
        if category in shared_categories:
            # For shared resources, get all records
            logger.debug(f"Querying shared category: {category}")
            query = self.db.query(model_class)
        else:
            # For patient-specific records, filter by patient_id
            # First check if the model has patient_id field
            if not hasattr(model_class, 'patient_id'):
                logger.error(f"Model {model_class.__name__} does not have patient_id field")
                return CategorySummary(count=0, records=[], has_more=False)
            
            logger.debug(f"Querying patient-specific category: {category} for patient_id: {patient_id}")
            query = self.db.query(model_class).filter(model_class.patient_id == patient_id)
        
        # Get total count
        try:
            total_count = query.count()
            logger.info(f"Category {category}: found {total_count} total records")
        except Exception as e:
            logger.error(f"Error counting records for {category}: {str(e)}", exc_info=True)
            return CategorySummary(count=0, records=[], has_more=False)
        
        # Get limited records for display (max 100 for UI performance)
        limit = 100
        
        # Order by created_at if it exists, otherwise by id
        try:
            if hasattr(model_class, 'created_at'):
                items = query.order_by(model_class.created_at.desc()).limit(limit).all()
            else:
                items = query.order_by(model_class.id.desc()).limit(limit).all()
        except Exception as e:
            logger.error(f"Error fetching records for {category}: {str(e)}", exc_info=True)
            return CategorySummary(count=0, records=[], has_more=False)
        
        # Convert to RecordSummary
        for item in items:
            logger.debug(f"Processing {category} item {item.id} for data summary")
            record_summary = self._convert_to_record_summary(item, category)
            if record_summary:
                records.append(record_summary)
            else:
                logger.warning(f"Failed to convert {category} item {item.id} to RecordSummary")
        
        logger.debug(f"Successfully converted {len(records)} records for {category}")
        
        return CategorySummary(
            count=total_count,
            records=records,
            has_more=total_count > limit
        )
    
    def _convert_to_record_summary(self, item: Any, category: str) -> Optional[RecordSummary]:
        """Convert a database model instance to RecordSummary"""
        try:
            # Debug logging
            logger.debug(f"Converting {category} record {getattr(item, 'id', 'unknown')}")
            logger.debug(f"Available fields: {[column.name for column in item.__table__.columns]}")
            
            # Use a generic approach that works for all models
            # Try to find the main name/title field
            title_field = self._get_title_field(item, category)
            logger.debug(f"Found title field for {category}")
            
            date_field = self._get_date_field(item, category)
            logger.debug(f"Date field for {category}: {date_field}")
            
            key_info = self._get_key_info(item, category)
            logger.debug(f"Generated key info for {category}")
            
            return RecordSummary(
                id=item.id,
                title=title_field or f"{category.replace('_', ' ').title()} #{item.id}",
                date=date_field,
                practitioner=getattr(item, 'practitioner_name', None) or getattr(item, 'provider_name', None),
                key_info=key_info,
                status=getattr(item, 'status', None)
            )
        except Exception as e:
            logger.error(f"Error converting {category} record {getattr(item, 'id', 'unknown')}: {str(e)}")
            # Return a basic record instead of None to ensure we don't lose data
            return RecordSummary(
                id=getattr(item, 'id', 0),
                title=f"{category.replace('_', ' ').title()} Record",
                date=None,
                practitioner=None,
                key_info="Details not available",
                status=None
            )
    
    def _get_title_field(self, item: Any, category: str) -> Optional[str]:
        """Get the appropriate title field for the category"""
        # Map categories to their specific name fields and fallback fields
        category_field_map = {
            'medications': {
                'primary': ['medication_name'],
                'fallbacks': ['generic_name', 'brand_name', 'indication', 'dosage']
            },
            'conditions': {
                'primary': ['condition_name'],
                'fallbacks': ['diagnosis', 'description', 'notes', 'icd_code']
            },
            'procedures': {
                'primary': ['procedure_name'],
                'fallbacks': ['procedure_code', 'description', 'notes']
            },
            'treatments': {
                'primary': ['treatment_name'],
                'fallbacks': ['treatment_type', 'description', 'notes']
            },
            'lab_results': {
                'primary': ['test_name'],
                'fallbacks': ['test_code', 'category', 'description']
            },
            'immunizations': {
                'primary': ['vaccine_name'],
                'fallbacks': ['vaccine_type', 'manufacturer', 'series']
            },
            'allergies': {
                'primary': ['allergen'],  # The actual field name is 'allergen'
                'fallbacks': ['reaction', 'category', 'severity']
            },
            'encounters': {
                'primary': ['reason'],
                'fallbacks': ['visit_type', 'chief_complaint', 'diagnosis', 'notes']
            },
            'vitals': {
                'primary': ['measurement_type'],
                'fallbacks': ['category', 'description']
            },
            'emergency_contacts': {
                'primary': ['name'],  # The actual field name is 'name'
                'fallbacks': ['relationship']
            },
            'practitioners': {
                'primary': ['name'],
                'fallbacks': ['full_name', 'first_name', 'last_name', 'specialty']
            },
            'pharmacies': {
                'primary': ['name'],
                'fallbacks': ['pharmacy_name', 'business_name', 'address']
            },
            'family_history': {
                'primary': ['name'],
                'fallbacks': ['relationship']
            }
        }
        
        # Get field configuration for this category
        field_config = category_field_map.get(category, {
            'primary': ['name', 'title'],
            'fallbacks': ['description', 'notes']
        })
        
        # Try primary fields first
        for field_name in field_config.get('primary', []):
            value = getattr(item, field_name, None)
            if value and str(value).strip():
                logger.debug(f"Found primary field '{field_name}' for {category}")
                return str(value).strip()
        
        # Try fallback fields
        for field_name in field_config.get('fallbacks', []):
            value = getattr(item, field_name, None)
            if value and str(value).strip():
                logger.debug(f"Using fallback field '{field_name}' for {category}")
                # Add a prefix to indicate this is a fallback field
                field_display = field_name.replace('_', ' ').title()
                return f"{str(value).strip()}"
        
        # Final fallback to common generic fields
        common_fields = ['name', 'title', 'full_name', 'description', 'notes']
        for field in common_fields:
            value = getattr(item, field, None)
            if value and str(value).strip():
                logger.debug(f"Using common fallback field '{field}' for {category}")
                return str(value).strip()
        
        logger.info(f"No title field found for {category}")
        return None
    
    def _get_date_field(self, item: Any, category: str) -> Optional[Any]:
        """Get the appropriate date field for the category"""
        # Map categories to their specific date fields
        category_date_map = {
            'medications': 'effective_period_start',
            'conditions': 'onset_date',
            'procedures': 'date', 
            'treatments': 'start_date',
            'lab_results': 'ordered_date',
            'immunizations': 'administered_date',
            'allergies': 'onset_date',
            'encounters': 'date',
            'vitals': 'measurement_date',
            'emergency_contacts': 'created_at',
            'practitioners': 'created_at',
            'pharmacies': 'created_at',
            'family_history': 'created_at'
        }
        
        # Try the specific field first
        if category in category_date_map:
            value = getattr(item, category_date_map[category], None)
            if value:
                return value
        
        # Fallback to common date fields
        common_date_fields = ['created_at', 'updated_at', 'date']
        for field in common_date_fields:
            value = getattr(item, field, None)
            if value:
                return value
        
        return None
    
    def _get_key_info(self, item: Any, category: str) -> str:
        """Get key information for the record based on category"""
        try:
            if category == 'medications':
                parts = []
                dosage = getattr(item, 'dosage', None)
                frequency = getattr(item, 'frequency', None)
                route = getattr(item, 'route', None)
                indication = getattr(item, 'indication', None)
                
                if dosage:
                    parts.append(f"Dosage: {dosage}")
                if frequency:
                    parts.append(f"Frequency: {frequency}")
                if route:
                    parts.append(f"Route: {route}")
                if indication:
                    parts.append(f"For: {indication}")
                
                return " | ".join(parts) if parts else "Medication details"
                
            elif category == 'conditions':
                parts = []
                severity = getattr(item, 'severity', None)
                verification_status = getattr(item, 'verification_status', None)
                
                if severity:
                    parts.append(f"Severity: {severity}")
                if verification_status:
                    parts.append(f"Status: {verification_status}")
                
                return " | ".join(parts) if parts else "Condition details"
                
            elif category == 'procedures':
                parts = []
                procedure_code = getattr(item, 'procedure_code', None)
                status = getattr(item, 'status', None)
                
                if procedure_code:
                    parts.append(f"Code: {procedure_code}")
                if status:
                    parts.append(f"Status: {status}")
                
                return " | ".join(parts) if parts else "Procedure details"
                
            elif category == 'lab_results':
                parts = []
                result_value = getattr(item, 'result_value', None)
                reference_range = getattr(item, 'reference_range', None)
                status = getattr(item, 'status', None)
                
                if result_value:
                    parts.append(f"Result: {result_value}")
                if reference_range:
                    parts.append(f"Range: {reference_range}")
                if status:
                    parts.append(f"Status: {status}")
                
                return " | ".join(parts) if parts else "Lab result details"
                
            elif category == 'immunizations':
                parts = []
                site = getattr(item, 'site', None)
                lot_number = getattr(item, 'lot_number', None)
                manufacturer = getattr(item, 'manufacturer', None)
                
                if site:
                    parts.append(f"Site: {site}")
                if manufacturer:
                    parts.append(f"Manufacturer: {manufacturer}")
                if lot_number:
                    parts.append(f"Lot: {lot_number}")
                
                return " | ".join(parts) if parts else "Immunization details"
                
            elif category == 'treatments':
                parts = []
                dosage = getattr(item, 'dosage', None)
                frequency = getattr(item, 'frequency', None)
                status = getattr(item, 'status', None)
                
                if dosage:
                    parts.append(f"Dosage: {dosage}")
                if frequency:
                    parts.append(f"Frequency: {frequency}")
                if status:
                    parts.append(f"Status: {status}")
                
                return " | ".join(parts) if parts else "Treatment details"
                
            elif category == 'vitals':
                return self._format_vitals_info(item)
                
            elif category == 'encounters':
                parts = []
                reason = getattr(item, 'reason', None)
                visit_type = getattr(item, 'visit_type', None)
                diagnosis = getattr(item, 'diagnosis', None)
                chief_complaint = getattr(item, 'chief_complaint', None)
                
                if reason:
                    parts.append(f"Reason: {reason}")
                if visit_type:
                    parts.append(f"Type: {visit_type}")
                if diagnosis:
                    parts.append(f"Diagnosis: {diagnosis}")
                elif chief_complaint:
                    parts.append(f"Complaint: {chief_complaint}")
                
                return " | ".join(parts) if parts else "Visit details"
                
            elif category == 'allergies':
                parts = []
                severity = getattr(item, 'severity', None)
                reaction = getattr(item, 'reaction', None)
                
                if severity:
                    parts.append(f"Severity: {severity}")
                if reaction:
                    parts.append(f"Reaction: {reaction}")
                
                return " | ".join(parts) if parts else "Allergy details"
            
            elif category == 'practitioners':
                parts = []
                practice = getattr(item, 'practice', None)
                specialty = getattr(item, 'specialty', None)
                phone = getattr(item, 'phone_number', None)
                
                if practice:
                    parts.append(f"Practice: {practice}")
                if specialty:
                    parts.append(f"Specialty: {specialty}")
                if phone:
                    parts.append(f"Phone: {phone}")
                
                return " | ".join(parts) if parts else "Practitioner details"
            
            elif category == 'pharmacies':
                parts = []
                brand = getattr(item, 'brand', None)
                address = getattr(item, 'address', None)
                phone = getattr(item, 'phone_number', None)
                
                if brand:
                    parts.append(f"Brand: {brand}")
                if address:
                    # Truncate long addresses
                    addr_display = address[:50] + "..." if len(address) > 50 else address
                    parts.append(addr_display)
                if phone:
                    parts.append(f"Phone: {phone}")
                
                return " | ".join(parts) if parts else "Pharmacy details"
            
            elif category == 'emergency_contacts':
                parts = []
                relationship = getattr(item, 'relationship', None)
                phone = getattr(item, 'phone_number', None)
                
                if relationship:
                    parts.append(relationship)
                if phone:
                    parts.append(f"Phone: {phone}")
                
                return " | ".join(parts) if parts else "Contact details"
            
            elif category == 'family_history':
                parts = []
                relationship = getattr(item, 'relationship', None)
                birth_year = getattr(item, 'birth_year', None)
                is_deceased = getattr(item, 'is_deceased', None)
                
                if relationship:
                    parts.append(relationship)
                if birth_year:
                    age_info = f"Born {birth_year}"
                    if is_deceased:
                        death_year = getattr(item, 'death_year', None)
                        if death_year:
                            age_info += f", died {death_year}"
                        else:
                            age_info += ", deceased"
                    parts.append(age_info)
                elif is_deceased:
                    parts.append("Deceased")
                
                # Try to get condition count from related conditions
                try:
                    condition_count = self.db.query(FamilyCondition).filter(
                        FamilyCondition.family_member_id == item.id
                    ).count()
                    if condition_count > 0:
                        parts.append(f"{condition_count} medical condition{'s' if condition_count != 1 else ''}")
                except Exception:
                    # If we can't get conditions, don't add to parts
                    pass
                
                return " | ".join(parts) if parts else "Family member details"
            
            return f"{category.replace('_', ' ').title()} record"
        except Exception:
            return "Details not available"
    
    def _format_vitals_info(self, vital: Vitals) -> str:
        """Format vital signs into a readable summary"""
        parts = []
        if hasattr(vital, 'blood_pressure_systolic') and vital.blood_pressure_systolic:
            parts.append(f"BP: {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic or '?'}")
        if hasattr(vital, 'heart_rate') and vital.heart_rate:
            parts.append(f"HR: {vital.heart_rate}")
        if hasattr(vital, 'temperature') and vital.temperature:
            parts.append(f"Temp: {vital.temperature}°")
        return " | ".join(parts) if parts else "No measurements"
    
    def _get_last_update_timestamp(self, patient_id: int) -> Optional[datetime]:
        """Get the most recent update timestamp across all categories"""
        latest = None
        
        for model_class in self.CATEGORY_MODELS.values():
            try:
                if hasattr(model_class, 'updated_at') and hasattr(model_class, 'patient_id'):
                    record = (self.db.query(model_class.updated_at)
                             .filter(model_class.patient_id == patient_id)
                             .order_by(model_class.updated_at.desc())
                             .first())
                    if record and record[0]:
                        if not latest or record[0] > latest:
                            latest = record[0]
            except Exception:
                continue
        
        return latest
    
    async def validate_record_ownership(
        self, 
        user_id: int, 
        selected_records: List[SelectiveRecordRequest]
    ):
        """Ensure user can only access their own records"""
        # Get patient ID for the user
        patient = self.db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient:
            raise PermissionError("No patient profile found for user")
        
        # Categories that don't have patient_id (shared resources)
        shared_categories = ['practitioners', 'pharmacies']
        
        for record_group in selected_records:
            if record_group.category not in self.CATEGORY_MODELS:
                raise ValueError(f"Invalid category: {record_group.category}")
            
            model_class = self.CATEGORY_MODELS[record_group.category]
            
            if record_group.category in shared_categories:
                # For shared resources, just validate that the IDs exist
                valid_ids = set(
                    record[0] for record in self.db.query(model_class.id)
                    .filter(model_class.id.in_(record_group.record_ids))
                    .all()
                )
            else:
                # Get valid record IDs for this user and category
                valid_ids = set(
                    record[0] for record in self.db.query(model_class.id)
                    .filter(model_class.patient_id == patient.id)
                    .filter(model_class.id.in_(record_group.record_ids))
                    .all()
                )
            
            # Check for invalid IDs
            requested_ids = set(record_group.record_ids)
            invalid_ids = requested_ids - valid_ids
            
            if invalid_ids:
                logger.warning(
                    f"User {user_id} attempted to access unauthorized "
                    f"{record_group.category} records: {invalid_ids}"
                )
                raise PermissionError(
                    f"Access denied to {record_group.category} records: {list(invalid_ids)}"
                )
    
    async def generate_selective_report(
        self, 
        user_id: int, 
        request: CustomReportRequest
    ) -> bytes:
        """Generate PDF with only selected records"""
        start_time = time.time()
        
        try:
            # Log report generation start
            await self._log_report_generation_start(user_id, request)
            
            # Validate ownership
            await self.validate_record_ownership(user_id, request.selected_records)
            
            # Get patient information
            patient = self.db.query(Patient).filter(Patient.user_id == user_id).first()
            if not patient:
                raise CustomReportError("No patient profile found")
            
            # Collect selected data
            report_data = {}
            failed_categories = []
            
            for record_group in request.selected_records:
                try:
                    category_data = await self._get_selected_records(
                        patient.id,
                        record_group.category,
                        record_group.record_ids
                    )
                    if category_data:
                        report_data[record_group.category] = category_data
                except Exception as e:
                    logger.error(
                        f"Failed to export {record_group.category} for user {user_id}: {str(e)}"
                    )
                    failed_categories.append(record_group.category)
            
            if not report_data and failed_categories:
                raise CustomReportError(
                    "No categories could be processed successfully",
                    details={'failed_categories': failed_categories}
                )
            
            # Generate PDF using export service
            pdf_data = await self._generate_pdf_report(
                patient,
                report_data,
                request,
                failed_categories
            )
            
            # Log successful generation
            generation_time = int((time.time() - start_time) * 1000)
            await self._log_report_generation_complete(
                user_id,
                request,
                generation_time,
                len(pdf_data),
                failed_categories
            )
            
            return pdf_data
            
        except Exception as e:
            # Log failed generation
            await self._log_report_generation_failed(user_id, request, str(e))
            raise
    
    async def _get_selected_records(
        self,
        patient_id: int,
        category: str,
        record_ids: List[int]
    ) -> List[Dict[str, Any]]:
        """Get specific records for a category"""
        if category not in self.CATEGORY_MODELS:
            raise ValueError(f"Invalid category: {category}")
        
        model_class = self.CATEGORY_MODELS[category]
        
        # Categories that don't have patient_id (shared resources)
        shared_categories = ['practitioners', 'pharmacies']
        
        if category in shared_categories:
            # For shared resources, just filter by IDs
            records = (self.db.query(model_class)
                      .filter(model_class.id.in_(record_ids))
                      .all())
        else:
            # For patient-specific records, filter by patient_id and IDs
            records = (self.db.query(model_class)
                      .filter(model_class.patient_id == patient_id)
                      .filter(model_class.id.in_(record_ids))
                      .all())
        
        logger.info(f"Retrieved {len(records)} {category} records for report generation")
        
        # Convert to dictionaries
        result = []
        for record in records:
            record_dict = self._model_to_dict(record)
            
            # Special handling for family history - include family conditions
            if category == 'family_history':
                family_member_id = record.id
                family_conditions = (self.db.query(FamilyCondition)
                                   .filter(FamilyCondition.family_member_id == family_member_id)
                                   .all())
                
                # Add conditions to the family member record
                record_dict['conditions'] = []
                for condition in family_conditions:
                    condition_dict = self._model_to_dict(condition)
                    record_dict['conditions'].append(condition_dict)
                
                logger.info(f"Family member {family_member_id} has {len(family_conditions)} conditions")
            
            # Special handling for encounters - include practitioner and condition names
            elif category == 'encounters':
                # Debug: Show all fields in the encounter record
                logger.debug(f"Processing encounter {record.id}")
                
                # Get practitioner name if linked
                if hasattr(record, 'practitioner_id') and record.practitioner_id:
                    practitioner = self.db.query(Practitioner).filter(Practitioner.id == record.practitioner_id).first()
                    if practitioner:
                        record_dict['practitioner_name'] = practitioner.name
                        logger.debug(f"Added practitioner information")
                    else:
                        logger.warning(f"Practitioner {record.practitioner_id} not found")
                else:
                    logger.debug(f"No practitioner linked to encounter {record.id}")
                
                # Get condition name if linked
                if hasattr(record, 'condition_id') and record.condition_id:
                    logger.debug(f"Looking up condition {record.condition_id}")
                    condition = self.db.query(Condition).filter(Condition.id == record.condition_id).first()
                    if condition:
                        # Try multiple fields for condition name, as condition_name might be null
                        condition_display = (
                            condition.condition_name or 
                            getattr(condition, 'diagnosis', None) or 
                            getattr(condition, 'description', None) or 
                            getattr(condition, 'icd_code', None) or
                            f"Condition #{condition.id}"
                        )
                        record_dict['condition_name'] = condition_display
                        logger.debug(f"Added condition information")
                    else:
                        logger.warning(f"Condition {record.condition_id} not found")
                else:
                    logger.debug(f"No condition linked to encounter {record.id}")
                
                logger.debug(f"Completed processing encounter {record.id}")
            
            # Special handling for treatments - include practitioner and condition names
            elif category == 'treatments':
                # Get practitioner name if linked
                if hasattr(record, 'practitioner_id') and record.practitioner_id:
                    practitioner = self.db.query(Practitioner).filter(Practitioner.id == record.practitioner_id).first()
                    if practitioner:
                        record_dict['practitioner_name'] = practitioner.name
                
                # Get condition name if linked
                if hasattr(record, 'condition_id') and record.condition_id:
                    condition = self.db.query(Condition).filter(Condition.id == record.condition_id).first()
                    if condition:
                        # Try multiple fields for condition name, as condition_name might be null
                        condition_display = (
                            condition.condition_name or 
                            getattr(condition, 'diagnosis', None) or 
                            getattr(condition, 'description', None) or 
                            getattr(condition, 'icd_code', None) or
                            f"Condition #{condition.id}"
                        )
                        record_dict['condition_name'] = condition_display
                
                logger.info(f"Treatment {record.id} enhanced with practitioner and condition info")
            
            # Special handling for procedures - include practitioner and condition names
            elif category == 'procedures':
                # Get practitioner name if linked
                if hasattr(record, 'practitioner_id') and record.practitioner_id:
                    practitioner = self.db.query(Practitioner).filter(Practitioner.id == record.practitioner_id).first()
                    if practitioner:
                        record_dict['practitioner_name'] = practitioner.name
                
                # Get condition name if linked
                if hasattr(record, 'condition_id') and record.condition_id:
                    condition = self.db.query(Condition).filter(Condition.id == record.condition_id).first()
                    if condition:
                        # Try multiple fields for condition name, as condition_name might be null
                        condition_display = (
                            condition.condition_name or 
                            getattr(condition, 'diagnosis', None) or 
                            getattr(condition, 'description', None) or 
                            getattr(condition, 'icd_code', None) or
                            f"Condition #{condition.id}"
                        )
                        record_dict['condition_name'] = condition_display
                
                logger.info(f"Procedure {record.id} enhanced with practitioner and condition info")
            
            # Special handling for medications - include pharmacy and prescriber names
            elif category == 'medications':
                # Get pharmacy name if linked
                if hasattr(record, 'pharmacy_id') and record.pharmacy_id:
                    pharmacy = self.db.query(Pharmacy).filter(Pharmacy.id == record.pharmacy_id).first()
                    if pharmacy:
                        record_dict['pharmacy_name'] = pharmacy.name
                
                # Get prescriber name if linked
                if hasattr(record, 'practitioner_id') and record.practitioner_id:
                    practitioner = self.db.query(Practitioner).filter(Practitioner.id == record.practitioner_id).first()
                    if practitioner:
                        record_dict['prescribing_practitioner'] = practitioner.name
                
                logger.info(f"Medication {record.id} enhanced with pharmacy and practitioner info")
            
            logger.debug(f"Processed record {record.id}")
            result.append(record_dict)
        
        return result
    
    def _model_to_dict(self, model_instance) -> Dict[str, Any]:
        """Convert SQLAlchemy model instance to dictionary"""
        result = {}
        for column in model_instance.__table__.columns:
            value = getattr(model_instance, column.name)
            # Convert datetime objects to strings for JSON serialization
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value
        return result
    
    async def _generate_pdf_report(
        self,
        patient: Patient,
        report_data: Dict[str, List[Dict]],
        request: CustomReportRequest,
        failed_categories: List[str]
    ) -> bytes:
        """Generate PDF report using the new custom PDF generator"""
        # Prepare data for PDF generator
        pdf_data = {
            'patient': self._model_to_dict(patient) if request.include_patient_info else None,
            'report_title': request.report_title,
            'generation_date': datetime.now(),
            'data': report_data,
            'summary': self._generate_summary(report_data) if request.include_summary else None,
            'failed_categories': failed_categories if failed_categories else None,
            'include_patient_info': request.include_patient_info,
            'include_summary': request.include_summary
        }
        
        # Use new PDF generator
        pdf_bytes = await self.pdf_generator.generate_pdf(pdf_data)
        return pdf_bytes
    
    def _generate_summary(self, report_data: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Generate summary statistics for the report"""
        summary = {
            'total_categories': len(report_data),
            'category_counts': {}
        }
        
        for category, records in report_data.items():
            summary['category_counts'][category] = len(records)
        
        summary['total_records'] = sum(summary['category_counts'].values())
        
        return summary
    
    async def save_report_template(
        self,
        user_id: int,
        template_data: ReportTemplateSchema
    ) -> int:
        """Save a report template for reuse"""
        # Validate that user owns the selected records
        await self.validate_record_ownership(user_id, template_data.selected_records)
        
        # Check if template name already exists for user
        existing = (self.db.query(ReportTemplate)
                   .filter(ReportTemplate.user_id == user_id)
                   .filter(ReportTemplate.name == template_data.name)
                   .filter(ReportTemplate.is_active == True)
                   .first())
        
        if existing:
            raise ValueError(f"Template with name '{template_data.name}' already exists")
        
        # Create new template
        db_template = ReportTemplate(
            user_id=user_id,
            name=template_data.name,
            description=template_data.description,
            selected_records=json.dumps([
                {'category': sr.category, 'record_ids': sr.record_ids}
                for sr in template_data.selected_records
            ]),
            report_settings=json.dumps(template_data.report_settings or {}),
            is_public=template_data.is_public,
            shared_with_family=template_data.shared_with_family
        )
        
        self.db.add(db_template)
        self.db.commit()
        self.db.refresh(db_template)
        
        logger.info(f"Template '{template_data.name}' saved by user {user_id}")
        return db_template.id
    
    async def get_saved_templates(self, user_id: int) -> List[ReportTemplateSchema]:
        """Get all templates accessible to user"""
        templates = (self.db.query(ReportTemplate)
                    .filter(ReportTemplate.user_id == user_id)
                    .filter(ReportTemplate.is_active == True)
                    .all())
        
        result = []
        for template in templates:
            # Parse JSON fields
            selected_records = json.loads(template.selected_records)
            report_settings = json.loads(template.report_settings)
            
            # Convert to schema
            result.append(ReportTemplateSchema(
                name=template.name,
                description=template.description,
                selected_records=[
                    SelectiveRecordRequest(
                        category=sr['category'],
                        record_ids=sr['record_ids']
                    )
                    for sr in selected_records
                ],
                report_settings=report_settings,
                is_public=template.is_public,
                shared_with_family=template.shared_with_family
            ))
        
        return result
    
    async def get_template(self, user_id: int, template_id: int) -> Optional[ReportTemplateSchema]:
        """Get a specific template"""
        template = (self.db.query(ReportTemplate)
                   .filter(ReportTemplate.id == template_id)
                   .filter(ReportTemplate.user_id == user_id)
                   .filter(ReportTemplate.is_active == True)
                   .first())
        
        if not template:
            return None
        
        # Parse and return
        selected_records = json.loads(template.selected_records)
        report_settings = json.loads(template.report_settings)
        
        return ReportTemplateSchema(
            name=template.name,
            description=template.description,
            selected_records=[
                SelectiveRecordRequest(
                    category=sr['category'],
                    record_ids=sr['record_ids']
                )
                for sr in selected_records
            ],
            report_settings=report_settings,
            is_public=template.is_public,
            shared_with_family=template.shared_with_family
        )
    
    async def update_template(
        self,
        user_id: int,
        template_id: int,
        template_data: ReportTemplateSchema
    ) -> bool:
        """Update an existing template"""
        template = (self.db.query(ReportTemplate)
                   .filter(ReportTemplate.id == template_id)
                   .filter(ReportTemplate.user_id == user_id)
                   .filter(ReportTemplate.is_active == True)
                   .first())
        
        if not template:
            return False
        
        # Validate ownership of new records
        await self.validate_record_ownership(user_id, template_data.selected_records)
        
        # Update template
        template.name = template_data.name
        template.description = template_data.description
        template.selected_records = json.dumps([
            {'category': sr.category, 'record_ids': sr.record_ids}
            for sr in template_data.selected_records
        ])
        template.report_settings = json.dumps(template_data.report_settings or {})
        template.is_public = template_data.is_public
        template.shared_with_family = template_data.shared_with_family
        template.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        logger.info(f"Template {template_id} updated by user {user_id}")
        return True
    
    async def delete_template(self, user_id: int, template_id: int) -> bool:
        """Soft delete a template"""
        template = (self.db.query(ReportTemplate)
                   .filter(ReportTemplate.id == template_id)
                   .filter(ReportTemplate.user_id == user_id)
                   .filter(ReportTemplate.is_active == True)
                   .first())
        
        if not template:
            return False
        
        # Soft delete
        template.is_active = False
        template.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        logger.info(f"Template {template_id} deleted by user {user_id}")
        return True
    
    async def _log_report_generation_start(
        self,
        user_id: int,
        request: CustomReportRequest
    ):
        """Log the start of report generation"""
        categories = [sr.category for sr in request.selected_records]
        total_records = sum(len(sr.record_ids) for sr in request.selected_records)
        
        logger.info(
            f"Report generation started - User: {user_id}, "
            f"Categories: {categories}, Total Records: {total_records}"
        )
    
    async def _log_report_generation_complete(
        self,
        user_id: int,
        request: CustomReportRequest,
        generation_time_ms: int,
        file_size: int,
        failed_categories: List[str]
    ):
        """Log successful report generation to audit table"""
        categories = [sr.category for sr in request.selected_records]
        total_records = sum(len(sr.record_ids) for sr in request.selected_records)
        
        audit = ReportGenerationAudit(
            user_id=user_id,
            report_type='custom_report',
            categories_included=categories,
            total_records=total_records,
            generation_time_ms=generation_time_ms,
            file_size_bytes=file_size,
            status='partial' if failed_categories else 'success',
            error_details=json.dumps({'failed_categories': failed_categories}) if failed_categories else None
        )
        
        self.db.add(audit)
        self.db.commit()
        
        logger.info(
            f"Report generated successfully - User: {user_id}, "
            f"Time: {generation_time_ms}ms, Size: {file_size} bytes"
        )
    
    async def _log_report_generation_failed(
        self,
        user_id: int,
        request: CustomReportRequest,
        error: str
    ):
        """Log failed report generation to audit table"""
        categories = [sr.category for sr in request.selected_records]
        total_records = sum(len(sr.record_ids) for sr in request.selected_records)
        
        audit = ReportGenerationAudit(
            user_id=user_id,
            report_type='custom_report',
            categories_included=categories,
            total_records=total_records,
            generation_time_ms=0,
            file_size_bytes=0,
            status='failed',
            error_details=error[:1000]  # Limit error message length
        )
        
        self.db.add(audit)
        self.db.commit()
        
        logger.error(
            f"Report generation failed - User: {user_id}, Error: {error}"
        )