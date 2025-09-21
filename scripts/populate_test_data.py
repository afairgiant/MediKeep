#!/usr/bin/env python3
"""
Test Data Population Script for Medical Records System

This script populates the database with comprehensive test data for all medical record types:
- Users and Patients
- Practitioners and Pharmacies
- Medical Records: Medications, Lab Results, Treatments, Procedures, Vital Signs,
  Conditions, Allergies, Immunizations, Visit History
- Supporting Data: Family History, Insurance, Emergency Contacts

Usage:
    # Create test data for all users/patients:
    python scripts/populate_test_data.py [--clear-first]

    # Create test data for specific user ID 1 and patient ID 1:
    python scripts/populate_test_data.py --user-id 1 --patient-id 1

Options:
    --clear-first: Clear all existing data before populating (WARNING: Destructive!)
    --user-id: Target specific user ID (requires --patient-id)
    --patient-id: Target specific patient ID (requires --user-id)
"""

import sys
import os
import argparse
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Dict, Any

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.core.logging_config import get_logger
from app.models.models import (
    User, Patient, Practitioner, Pharmacy, Medication, LabResult, Treatment,
    Procedure, Vitals, Condition, Allergy, Immunization, Encounter,
    EmergencyContact, FamilyMember, FamilyCondition, Insurance, UserTag
)
from app.models.enums import (
    MedicationStatus, LabResultStatus, TreatmentStatus, ProcedureStatus,
    ConditionStatus, AllergyStatus, SeverityLevel, EncounterPriority,
    FamilyRelationship, ConditionType, InsuranceType, InsuranceStatus
)
from app.services.auth import AuthService

# Initialize logger
logger = get_logger(__name__, "app")

class TestDataPopulator:
    """Test data population utility for medical records system"""

    def __init__(self, db_session: Session, target_user_id: int = None, target_patient_id: int = None):
        self.db = db_session
        self.target_user_id = target_user_id
        self.target_patient_id = target_patient_id
        self.users = []
        self.patients = []
        self.practitioners = []
        self.pharmacies = []

    def clear_all_data(self):
        """Clear all existing data from the database (WARNING: Destructive!)"""
        logger.warning("Clearing all existing data from database")

        # Delete in reverse dependency order to avoid foreign key constraints
        tables_to_clear = [
            'user_tags', 'family_conditions', 'family_members', 'emergency_contacts',
            'insurances', 'encounters', 'immunizations', 'allergies', 'vitals',
            'treatments', 'procedures', 'conditions', 'lab_results', 'medications',
            'patients', 'practitioners', 'pharmacies', 'users'
        ]

        for table in tables_to_clear:
            try:
                self.db.execute(f"DELETE FROM {table}")
                logger.info(f"Cleared table: {table}")
            except Exception as e:
                logger.warning(f"Failed to clear table {table}: {e}")

        self.db.commit()
        logger.info("Database cleared successfully")

    def create_users_and_patients(self):
        """Create test users and their corresponding patients or use existing ones"""
        if self.target_user_id and self.target_patient_id:
            logger.info(f"Using existing user ID {self.target_user_id} and patient ID {self.target_patient_id}")

            # Get existing user and patient
            user = self.db.query(User).filter(User.id == self.target_user_id).first()
            patient = self.db.query(Patient).filter(Patient.id == self.target_patient_id).first()

            if not user:
                raise ValueError(f"User with ID {self.target_user_id} not found")
            if not patient:
                raise ValueError(f"Patient with ID {self.target_patient_id} not found")

            self.users.append(user)
            self.patients.append(patient)
            logger.info(f"Using existing user: {user.username} and patient: {patient.first_name} {patient.last_name}")
            return

        logger.info("Creating test users and patients")

        test_users_data = [
            {
                "username": "admin",
                "password": "admin123",
                "email": "admin@medicalrecords.com",
                "full_name": "System Administrator",
                "role": "admin",
                "patient_data": {
                    "first_name": "System",
                    "last_name": "Administrator",
                    "birth_date": date(1985, 1, 15),
                    "gender": "M",
                    "blood_type": "O+",
                    "height": 72.0,
                    "weight": 180.0,
                    "address": "123 Admin St, Medical City, MC 12345"
                }
            },
            {
                "username": "john_doe",
                "password": "password123",
                "email": "john.doe@email.com",
                "full_name": "John Doe",
                "role": "user",
                "patient_data": {
                    "first_name": "John",
                    "last_name": "Doe",
                    "birth_date": date(1990, 5, 20),
                    "gender": "M",
                    "blood_type": "A+",
                    "height": 70.0,
                    "weight": 175.0,
                    "address": "456 Main St, Anytown, AT 67890"
                }
            },
            {
                "username": "jane_smith",
                "password": "password123",
                "email": "jane.smith@email.com",
                "full_name": "Jane Smith",
                "role": "user",
                "patient_data": {
                    "first_name": "Jane",
                    "last_name": "Smith",
                    "birth_date": date(1988, 12, 3),
                    "gender": "F",
                    "blood_type": "B-",
                    "height": 65.0,
                    "weight": 135.0,
                    "address": "789 Oak Ave, Springfield, SP 11111"
                }
            },
            {
                "username": "bob_johnson",
                "password": "password123",
                "email": "bob.johnson@email.com",
                "full_name": "Robert Johnson",
                "role": "user",
                "patient_data": {
                    "first_name": "Robert",
                    "last_name": "Johnson",
                    "birth_date": date(1975, 8, 14),
                    "gender": "M",
                    "blood_type": "AB+",
                    "height": 68.0,
                    "weight": 190.0,
                    "address": "321 Pine Rd, Riverside, RS 22222"
                }
            }
        ]

        for user_data in test_users_data:
            # Create user
            user = AuthService.create_user(
                self.db,
                username=user_data["username"],
                password=user_data["password"],
                email=user_data["email"],
                full_name=user_data["full_name"],
                role=user_data["role"]
            )
            self.users.append(user)

            # Create corresponding patient
            patient_data = user_data["patient_data"]
            patient = Patient(
                user_id=user.id,
                owner_user_id=user.id,
                is_self_record=True,
                **patient_data
            )
            self.db.add(patient)
            self.patients.append(patient)

        self.db.commit()
        logger.info(f"Created {len(self.users)} users and {len(self.patients)} patients")

    def create_practitioners(self):
        """Create test practitioners"""
        logger.info("Creating test practitioners")

        practitioners_data = [
            {
                "name": "Dr. Sarah Wilson",
                "specialty": "Family Medicine",
                "practice": "City Medical Center",
                "phone_number": "(555) 123-4567",
                "website": "https://citymedical.com/dr-wilson",
                "rating": 4.8
            },
            {
                "name": "Dr. Michael Chen",
                "specialty": "Cardiology",
                "practice": "Heart Health Associates",
                "phone_number": "(555) 234-5678",
                "website": "https://hearthealthassoc.com",
                "rating": 4.9
            },
            {
                "name": "Dr. Jennifer Martinez",
                "specialty": "Endocrinology",
                "practice": "Diabetes & Hormone Center",
                "phone_number": "(555) 345-6789",
                "website": "https://diabeteshormone.com",
                "rating": 4.7
            },
            {
                "name": "Dr. David Brown",
                "specialty": "Dermatology",
                "practice": "Skin Health Clinic",
                "phone_number": "(555) 456-7890",
                "website": "https://skinhealthclinic.com",
                "rating": 4.6
            },
            {
                "name": "Dr. Lisa Thompson",
                "specialty": "Psychiatry",
                "practice": "Mental Wellness Center",
                "phone_number": "(555) 567-8901",
                "website": "https://mentalwellnesscenter.com",
                "rating": 4.8
            }
        ]

        for pract_data in practitioners_data:
            practitioner = Practitioner(**pract_data)
            self.db.add(practitioner)
            self.practitioners.append(practitioner)

        self.db.commit()
        logger.info(f"Created {len(self.practitioners)} practitioners")

    def create_pharmacies(self):
        """Create test pharmacies"""
        logger.info("Creating test pharmacies")

        pharmacies_data = [
            {
                "name": "CVS Pharmacy - Main Street",
                "brand": "CVS",
                "street_address": "100 Main St",
                "city": "Anytown",
                "state": "AT",
                "zip_code": "67890",
                "country": "USA",
                "store_number": "1234",
                "phone_number": "(555) 111-2222",
                "drive_through": True,
                "twenty_four_hour": False,
                "specialty_services": "Vaccinations, Blood Pressure Checks"
            },
            {
                "name": "Walgreens - Downtown",
                "brand": "Walgreens",
                "street_address": "200 Downtown Blvd",
                "city": "Springfield",
                "state": "SP",
                "zip_code": "11111",
                "country": "USA",
                "store_number": "5678",
                "phone_number": "(555) 222-3333",
                "drive_through": True,
                "twenty_four_hour": True,
                "specialty_services": "24-Hour Service, Flu Shots"
            },
            {
                "name": "HealthMart Pharmacy",
                "brand": "HealthMart",
                "street_address": "300 Health Way",
                "city": "Medical City",
                "state": "MC",
                "zip_code": "12345",
                "country": "USA",
                "phone_number": "(555) 333-4444",
                "drive_through": False,
                "twenty_four_hour": False,
                "specialty_services": "Compounding, Medication Therapy Management"
            }
        ]

        for pharm_data in pharmacies_data:
            pharmacy = Pharmacy(**pharm_data)
            self.db.add(pharmacy)
            self.pharmacies.append(pharmacy)

        self.db.commit()
        logger.info(f"Created {len(self.pharmacies)} pharmacies")

    def create_medications(self):
        """Create test medications for patients"""
        logger.info("Creating test medications")

        medications_data = [
            {
                "medication_name": "Lisinopril",
                "dosage": "10mg",
                "frequency": "Once daily",
                "route": "Oral",
                "indication": "Hypertension",
                "status": MedicationStatus.ACTIVE.value,
                "tags": ["blood pressure", "cardiovascular"]
            },
            {
                "medication_name": "Metformin",
                "dosage": "500mg",
                "frequency": "Twice daily",
                "route": "Oral",
                "indication": "Type 2 Diabetes",
                "status": MedicationStatus.ACTIVE.value,
                "tags": ["diabetes", "blood sugar"]
            },
            {
                "medication_name": "Atorvastatin",
                "dosage": "20mg",
                "frequency": "Once daily at bedtime",
                "route": "Oral",
                "indication": "High cholesterol",
                "status": MedicationStatus.ACTIVE.value,
                "tags": ["cholesterol", "cardiovascular"]
            },
            {
                "medication_name": "Albuterol Inhaler",
                "dosage": "2 puffs",
                "frequency": "As needed for wheezing",
                "route": "Inhalation",
                "indication": "Asthma",
                "status": MedicationStatus.ACTIVE.value,
                "tags": ["asthma", "respiratory"]
            },
            {
                "medication_name": "Omeprazole",
                "dosage": "20mg",
                "frequency": "Once daily before meals",
                "route": "Oral",
                "indication": "GERD",
                "status": MedicationStatus.COMPLETED.value,
                "effective_period_start": date(2024, 1, 1),
                "effective_period_end": date(2024, 6, 1),
                "tags": ["stomach", "acid reflux"]
            }
        ]

        # Create medications for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all medications when targeting specific patient, otherwise 2-3
            if self.target_patient_id:
                patient_medications = medications_data
            else:
                start_idx = (i * 2) % len(medications_data)
                patient_medications = medications_data[start_idx:start_idx + 3]

            for med_data in patient_medications:
                medication = Medication(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    pharmacy_id=self.pharmacies[i % len(self.pharmacies)].id,
                    **med_data
                )
                self.db.add(medication)

        self.db.commit()
        logger.info("Created test medications")

    def create_lab_results(self):
        """Create test lab results for patients"""
        logger.info("Creating test lab results")

        lab_results_data = [
            {
                "test_name": "Complete Blood Count (CBC)",
                "test_category": "blood work",
                "test_type": "routine",
                "facility": "City Lab Services",
                "status": LabResultStatus.COMPLETED.value,
                "labs_result": "normal",
                "ordered_date": date(2024, 8, 1),
                "completed_date": date(2024, 8, 3),
                "notes": "All values within normal limits",
                "tags": ["blood work", "routine"]
            },
            {
                "test_name": "Lipid Panel",
                "test_category": "blood work",
                "test_type": "routine",
                "facility": "City Lab Services",
                "status": LabResultStatus.COMPLETED.value,
                "labs_result": "high",
                "ordered_date": date(2024, 7, 15),
                "completed_date": date(2024, 7, 17),
                "notes": "Total cholesterol 240 mg/dL (elevated)",
                "tags": ["cholesterol", "cardiovascular"]
            },
            {
                "test_name": "Hemoglobin A1C",
                "test_category": "blood work",
                "test_type": "follow-up",
                "facility": "Diabetes Care Lab",
                "status": LabResultStatus.COMPLETED.value,
                "labs_result": "normal",
                "ordered_date": date(2024, 8, 10),
                "completed_date": date(2024, 8, 12),
                "notes": "A1C 6.8% - diabetes well controlled",
                "tags": ["diabetes", "a1c"]
            },
            {
                "test_name": "Chest X-Ray",
                "test_category": "imaging",
                "test_type": "screening",
                "facility": "Riverside Imaging Center",
                "status": LabResultStatus.COMPLETED.value,
                "labs_result": "normal",
                "ordered_date": date(2024, 6, 20),
                "completed_date": date(2024, 6, 20),
                "notes": "No acute findings. Lungs clear.",
                "tags": ["imaging", "respiratory"]
            }
        ]

        # Create lab results for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all lab results when targeting specific patient, otherwise 2-3
            if self.target_patient_id:
                patient_lab_results = lab_results_data
            else:
                num_results = 2 + (i % 2)
                patient_lab_results = lab_results_data[:num_results]

            for lab_data in patient_lab_results:
                lab_result = LabResult(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **lab_data
                )
                self.db.add(lab_result)

        self.db.commit()
        logger.info("Created test lab results")

    def create_conditions(self):
        """Create test medical conditions for patients"""
        logger.info("Creating test conditions")

        conditions_data = [
            {
                "condition_name": "Essential Hypertension",
                "diagnosis": "Primary hypertension without known cause",
                "status": ConditionStatus.ACTIVE.value,
                "severity": SeverityLevel.MODERATE.value,
                "onset_date": date(2020, 3, 15),
                "icd10_code": "I10",
                "notes": "Well controlled with medication",
                "tags": ["cardiovascular", "chronic"]
            },
            {
                "condition_name": "Type 2 Diabetes Mellitus",
                "diagnosis": "Non-insulin dependent diabetes",
                "status": ConditionStatus.CHRONIC.value,
                "severity": SeverityLevel.MODERATE.value,
                "onset_date": date(2018, 7, 22),
                "icd10_code": "E11.9",
                "notes": "Diet controlled, A1C stable",
                "tags": ["diabetes", "chronic", "endocrine"]
            },
            {
                "condition_name": "Hyperlipidemia",
                "diagnosis": "Elevated cholesterol levels",
                "status": ConditionStatus.ACTIVE.value,
                "severity": SeverityLevel.MILD.value,
                "onset_date": date(2019, 11, 8),
                "icd10_code": "E78.5",
                "notes": "Responding well to statin therapy",
                "tags": ["cholesterol", "cardiovascular"]
            },
            {
                "condition_name": "Seasonal Allergies",
                "diagnosis": "Allergic rhinitis due to pollen",
                "status": ConditionStatus.ACTIVE.value,
                "severity": SeverityLevel.MILD.value,
                "onset_date": date(2015, 4, 1),
                "icd10_code": "J30.1",
                "notes": "Symptoms worse during spring months",
                "tags": ["allergies", "seasonal"]
            }
        ]

        # Create conditions for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all conditions when targeting specific patient, otherwise 1-2
            if self.target_patient_id:
                patient_conditions = conditions_data
            else:
                num_conditions = 1 + (i % 2)
                patient_conditions = conditions_data[:num_conditions]

            for condition_data in patient_conditions:
                condition = Condition(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **condition_data
                )
                self.db.add(condition)

        self.db.commit()
        logger.info("Created test conditions")

    def create_allergies(self):
        """Create test allergies for patients"""
        logger.info("Creating test allergies")

        allergies_data = [
            {
                "allergen": "Penicillin",
                "reaction": "Skin rash and hives",
                "severity": SeverityLevel.MODERATE.value,
                "status": AllergyStatus.ACTIVE.value,
                "onset_date": date(2010, 6, 15),
                "notes": "Developed rash after taking amoxicillin",
                "tags": ["drug allergy", "antibiotic"]
            },
            {
                "allergen": "Peanuts",
                "reaction": "Anaphylaxis",
                "severity": SeverityLevel.SEVERE.value,
                "status": AllergyStatus.ACTIVE.value,
                "onset_date": date(2005, 2, 20),
                "notes": "Carries EpiPen at all times",
                "tags": ["food allergy", "anaphylaxis"]
            },
            {
                "allergen": "Shellfish",
                "reaction": "Nausea and vomiting",
                "severity": SeverityLevel.MILD.value,
                "status": AllergyStatus.ACTIVE.value,
                "onset_date": date(2012, 8, 10),
                "notes": "Avoids all shellfish",
                "tags": ["food allergy"]
            },
            {
                "allergen": "Latex",
                "reaction": "Contact dermatitis",
                "severity": SeverityLevel.MILD.value,
                "status": AllergyStatus.ACTIVE.value,
                "onset_date": date(2015, 1, 5),
                "notes": "Uses latex-free gloves",
                "tags": ["contact allergy"]
            }
        ]

        # Create allergies for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all allergies when targeting specific patient, otherwise 1-2
            if self.target_patient_id:
                patient_allergies = allergies_data
            else:
                num_allergies = 1 + (i % 2)
                patient_allergies = allergies_data[:num_allergies]

            for allergy_data in patient_allergies:
                allergy = Allergy(
                    patient_id=patient.id,
                    **allergy_data
                )
                self.db.add(allergy)

        self.db.commit()
        logger.info("Created test allergies")

    def create_procedures(self):
        """Create test procedures for patients"""
        logger.info("Creating test procedures")

        procedures_data = [
            {
                "procedure_name": "Colonoscopy",
                "procedure_type": "Diagnostic",
                "procedure_code": "45378",
                "date": date(2024, 5, 15),
                "description": "Screening colonoscopy",
                "status": ProcedureStatus.COMPLETED.value,
                "facility": "Gastroenterology Associates",
                "procedure_setting": "Outpatient",
                "procedure_duration": 30,
                "notes": "Normal findings, no polyps detected",
                "tags": ["screening", "gastroenterology"]
            },
            {
                "procedure_name": "Echocardiogram",
                "procedure_type": "Diagnostic",
                "procedure_code": "93312",
                "date": date(2024, 7, 8),
                "description": "Transthoracic echocardiogram",
                "status": ProcedureStatus.COMPLETED.value,
                "facility": "Heart Health Associates",
                "procedure_setting": "Outpatient",
                "procedure_duration": 45,
                "notes": "Normal left ventricular function",
                "tags": ["cardiology", "diagnostic"]
            },
            {
                "procedure_name": "Skin Biopsy",
                "procedure_type": "Diagnostic",
                "procedure_code": "11100",
                "date": date(2024, 6, 22),
                "description": "Punch biopsy of suspicious mole",
                "status": ProcedureStatus.COMPLETED.value,
                "facility": "Skin Health Clinic",
                "procedure_setting": "Office",
                "procedure_duration": 15,
                "anesthesia_type": "Local",
                "notes": "Benign nevus, no malignancy",
                "tags": ["dermatology", "biopsy"]
            }
        ]

        # Create procedures for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            if self.target_patient_id:
                # Target patient gets all procedures
                patient_procedures = procedures_data
            else:
                # Other patients get one procedure if available
                patient_procedures = [procedures_data[i]] if i < len(procedures_data) else []

            for procedure_data in patient_procedures:
                procedure = Procedure(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **procedure_data
                )
                self.db.add(procedure)

        self.db.commit()
        logger.info("Created test procedures")

    def create_treatments(self):
        """Create test treatments for patients"""
        logger.info("Creating test treatments")

        treatments_data = [
            {
                "treatment_name": "Physical Therapy",
                "treatment_type": "Rehabilitation",
                "start_date": date(2024, 6, 1),
                "end_date": date(2024, 8, 1),
                "status": TreatmentStatus.COMPLETED.value,
                "treatment_category": "Outpatient",
                "frequency": "3 times per week",
                "location": "City Physical Therapy",
                "description": "Post-operative knee rehabilitation",
                "outcome": "Full range of motion restored",
                "tags": ["rehabilitation", "orthopedic"]
            },
            {
                "treatment_name": "Cognitive Behavioral Therapy",
                "treatment_type": "Psychotherapy",
                "start_date": date(2024, 4, 15),
                "status": TreatmentStatus.ACTIVE.value,
                "treatment_category": "Outpatient",
                "frequency": "Weekly",
                "location": "Mental Wellness Center",
                "description": "CBT for anxiety management",
                "notes": "Good progress with coping strategies",
                "tags": ["mental health", "therapy"]
            },
            {
                "treatment_name": "Diabetes Education",
                "treatment_type": "Patient Education",
                "start_date": date(2024, 3, 1),
                "end_date": date(2024, 3, 31),
                "status": TreatmentStatus.COMPLETED.value,
                "treatment_category": "Outpatient",
                "frequency": "Weekly for 4 weeks",
                "location": "Diabetes & Hormone Center",
                "description": "Comprehensive diabetes self-management education",
                "outcome": "Improved A1C from 8.2% to 6.8%",
                "tags": ["diabetes", "education"]
            }
        ]

        # Create treatments for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            if self.target_patient_id:
                # Target patient gets all treatments
                patient_treatments = treatments_data
            else:
                # Other patients get one treatment if available
                patient_treatments = [treatments_data[i]] if i < len(treatments_data) else []

            for treatment_data in patient_treatments:
                treatment = Treatment(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **treatment_data
                )
                self.db.add(treatment)

        self.db.commit()
        logger.info("Created test treatments")

    def create_immunizations(self):
        """Create test immunizations for patients"""
        logger.info("Creating test immunizations")

        immunizations_data = [
            {
                "vaccine_name": "Influenza",
                "vaccine_trade_name": "Flublok Quadrivalent 2024-2025",
                "date_administered": date(2024, 9, 15),
                "dose_number": 1,
                "manufacturer": "Sanofi Pasteur",
                "site": "Left deltoid",
                "route": "Intramuscular",
                "location": "CVS Pharmacy",
                "notes": "Annual flu shot, no adverse reactions",
                "tags": ["influenza", "annual"]
            },
            {
                "vaccine_name": "COVID-19",
                "vaccine_trade_name": "Pfizer-BioNTech COVID-19 Vaccine",
                "date_administered": date(2024, 8, 20),
                "dose_number": 3,
                "manufacturer": "Pfizer-BioNTech",
                "site": "Right deltoid",
                "route": "Intramuscular",
                "location": "Walgreens Pharmacy",
                "notes": "Updated booster, mild soreness at injection site",
                "tags": ["covid-19", "booster"]
            },
            {
                "vaccine_name": "Tetanus, Diphtheria, Pertussis (Tdap)",
                "vaccine_trade_name": "Adacel",
                "date_administered": date(2023, 5, 10),
                "dose_number": 1,
                "manufacturer": "Sanofi Pasteur",
                "site": "Left deltoid",
                "route": "Intramuscular",
                "location": "City Medical Center",
                "notes": "Routine 10-year booster",
                "tags": ["tetanus", "routine"]
            },
            {
                "vaccine_name": "Pneumococcal",
                "vaccine_trade_name": "Pneumovax 23",
                "date_administered": date(2023, 11, 5),
                "dose_number": 1,
                "manufacturer": "Merck",
                "site": "Right deltoid",
                "route": "Intramuscular",
                "location": "Family Medicine Clinic",
                "notes": "Recommended for adults over 65",
                "tags": ["pneumonia", "elderly"]
            }
        ]

        # Create immunizations for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all immunizations when targeting specific patient, otherwise 2-3
            if self.target_patient_id:
                patient_immunizations = immunizations_data
            else:
                num_immunizations = 2 + (i % 2)
                patient_immunizations = immunizations_data[:num_immunizations]

            for immunization_data in patient_immunizations:
                immunization = Immunization(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **immunization_data
                )
                self.db.add(immunization)

        self.db.commit()
        logger.info("Created test immunizations")

    def create_vital_signs(self):
        """Create test vital signs for patients"""
        logger.info("Creating test vital signs")

        # Generate vitals for the last 6 months
        base_date = datetime.now() - timedelta(days=180)

        # Create vitals for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for patient in target_patients:
            # Each patient gets 6 vital sign entries (monthly)
            for i in range(6):
                record_date = base_date + timedelta(days=30*i)

                # Generate realistic vital signs with some variation
                # Use default values if patient weight/height are None
                base_weight = patient.weight if patient.weight is not None else 150.0
                base_height = patient.height if patient.height is not None else 68.0
                current_weight = base_weight + (i * 0.5)

                # Calculate BMI safely (weight in lbs, height in inches)
                bmi = None
                if base_height and current_weight:
                    bmi = round((current_weight / (base_height ** 2)) * 703, 1)

                vitals = Vitals(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[0].id,  # Primary care physician
                    recorded_date=record_date,
                    systolic_bp=120 + (i * 2) + (patient.id % 10),  # Slight variation
                    diastolic_bp=80 + (i % 5) + (patient.id % 5),
                    heart_rate=70 + (patient.id % 15),
                    temperature=98.6 + ((patient.id % 3) * 0.2),
                    weight=current_weight,
                    height=base_height,
                    oxygen_saturation=98.0 + (patient.id % 3),
                    respiratory_rate=16 + (patient.id % 4),
                    bmi=bmi,
                    pain_scale=(i % 3),  # 0-2 pain scale
                    notes=f"Routine visit #{i+1}",
                    location="City Medical Center"
                )
                self.db.add(vitals)

        self.db.commit()
        logger.info("Created test vital signs")

    def create_encounters(self):
        """Create test medical encounters/visits for patients"""
        logger.info("Creating test encounters")

        encounters_data = [
            {
                "reason": "Annual physical examination",
                "date": date(2024, 8, 15),
                "visit_type": "annual checkup",
                "chief_complaint": "Routine annual physical",
                "diagnosis": "No acute issues identified",
                "treatment_plan": "Continue current medications, return in 1 year",
                "follow_up_instructions": "Schedule mammogram and colonoscopy",
                "duration_minutes": 45,
                "location": "office",
                "priority": EncounterPriority.ROUTINE.value,
                "notes": "Patient reports feeling well overall",
                "tags": ["annual", "physical"]
            },
            {
                "reason": "Follow-up for diabetes management",
                "date": date(2024, 7, 10),
                "visit_type": "follow-up",
                "chief_complaint": "Diabetes follow-up",
                "diagnosis": "Type 2 diabetes, well controlled",
                "treatment_plan": "Continue metformin, increase exercise",
                "follow_up_instructions": "Return in 3 months for A1C check",
                "duration_minutes": 30,
                "location": "office",
                "priority": EncounterPriority.ROUTINE.value,
                "notes": "A1C improved from 7.2% to 6.8%",
                "tags": ["diabetes", "follow-up"]
            },
            {
                "reason": "Acute upper respiratory infection",
                "date": date(2024, 6, 5),
                "visit_type": "sick visit",
                "chief_complaint": "Cough and congestion for 5 days",
                "diagnosis": "Viral upper respiratory infection",
                "treatment_plan": "Supportive care, rest, fluids",
                "follow_up_instructions": "Return if symptoms worsen or persist >10 days",
                "duration_minutes": 20,
                "location": "office",
                "priority": EncounterPriority.URGENT.value,
                "notes": "No fever, clear lungs on exam",
                "tags": ["respiratory", "viral"]
            }
        ]

        # Create encounters for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all encounters when targeting specific patient, otherwise 2-3
            if self.target_patient_id:
                patient_encounters = encounters_data
            else:
                num_encounters = 2 + (i % 2)
                patient_encounters = encounters_data[:num_encounters]

            for encounter_data in patient_encounters:
                encounter = Encounter(
                    patient_id=patient.id,
                    practitioner_id=self.practitioners[i % len(self.practitioners)].id,
                    **encounter_data
                )
                self.db.add(encounter)

        self.db.commit()
        logger.info("Created test encounters")

    def create_emergency_contacts(self):
        """Create test emergency contacts for patients"""
        logger.info("Creating test emergency contacts")

        emergency_contacts_data = [
            {
                "name": "Sarah Doe",
                "relationship": "spouse",
                "phone_number": "(555) 111-1111",
                "secondary_phone": "(555) 111-2222",
                "email": "sarah.doe@email.com",
                "is_primary": True,
                "address": "456 Main St, Anytown, AT 67890",
                "notes": "Available 24/7"
            },
            {
                "name": "Michael Smith",
                "relationship": "brother",
                "phone_number": "(555) 222-3333",
                "email": "michael.smith@email.com",
                "is_primary": False,
                "address": "789 Oak Ave, Springfield, SP 11111",
                "notes": "Emergency contact if spouse unavailable"
            },
            {
                "name": "Mary Johnson",
                "relationship": "daughter",
                "phone_number": "(555) 333-4444",
                "email": "mary.johnson@email.com",
                "is_primary": True,
                "address": "321 Pine Rd, Riverside, RS 22222",
                "notes": "Lives nearby, available most days"
            }
        ]

        # Create emergency contacts for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all emergency contacts when targeting specific patient, otherwise 1-2
            if self.target_patient_id:
                patient_contacts = emergency_contacts_data
            else:
                num_contacts = 1 + (i % 2)
                patient_contacts = emergency_contacts_data[:num_contacts]

            for contact_data in patient_contacts:
                contact = EmergencyContact(
                    patient_id=patient.id,
                    **contact_data
                )
                self.db.add(contact)

        self.db.commit()
        logger.info("Created test emergency contacts")

    def create_family_history(self):
        """Create test family history for patients"""
        logger.info("Creating test family history")

        family_members_data = [
            {
                "name": "Robert Doe Sr.",
                "relationship": FamilyRelationship.FATHER.value,
                "gender": "M",
                "birth_year": 1950,
                "is_deceased": True,
                "death_year": 2020,
                "notes": "Passed away from heart attack",
                "conditions": [
                    {
                        "condition_name": "Coronary Artery Disease",
                        "diagnosis_age": 60,
                        "severity": SeverityLevel.SEVERE.value,
                        "status": "chronic",
                        "condition_type": ConditionType.CARDIOVASCULAR.value,
                        "notes": "Multiple heart attacks"
                    },
                    {
                        "condition_name": "Hypertension",
                        "diagnosis_age": 45,
                        "severity": SeverityLevel.MODERATE.value,
                        "status": "chronic"
                    }
                ]
            },
            {
                "name": "Mary Doe",
                "relationship": FamilyRelationship.MOTHER.value,
                "gender": "F",
                "birth_year": 1955,
                "is_deceased": False,
                "notes": "Living, generally healthy",
                "conditions": [
                    {
                        "condition_name": "Type 2 Diabetes",
                        "diagnosis_age": 65,
                        "severity": SeverityLevel.MILD.value,
                        "status": "active",
                        "condition_type": ConditionType.DIABETES.value,
                        "notes": "Well controlled with diet"
                    }
                ]
            },
            {
                "name": "Jennifer Doe",
                "relationship": FamilyRelationship.SISTER.value,
                "gender": "F",
                "birth_year": 1985,
                "is_deceased": False,
                "notes": "Living, has breast cancer history",
                "conditions": [
                    {
                        "condition_name": "Breast Cancer",
                        "diagnosis_age": 35,
                        "severity": SeverityLevel.SEVERE.value,
                        "status": "resolved",
                        "condition_type": ConditionType.CANCER.value,
                        "notes": "Successfully treated, in remission"
                    }
                ]
            }
        ]

        # Create family history for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all family members when targeting specific patient, otherwise 2-3
            if self.target_patient_id:
                num_family = len(family_members_data)
            else:
                num_family = 2 + (i % 2)

            for j in range(num_family):
                family_data = family_members_data[j % len(family_members_data)].copy()
                conditions_data = family_data.pop("conditions")

                family_member = FamilyMember(
                    patient_id=patient.id,
                    **family_data
                )
                self.db.add(family_member)
                self.db.flush()  # Get the ID for conditions

                # Add family member conditions
                for condition_data in conditions_data:
                    family_condition = FamilyCondition(
                        family_member_id=family_member.id,
                        **condition_data
                    )
                    self.db.add(family_condition)

        self.db.commit()
        logger.info("Created test family history")

    def create_insurance(self):
        """Create test insurance records for patients"""
        logger.info("Creating test insurance")

        insurance_data = [
            {
                "insurance_type": InsuranceType.MEDICAL.value,
                "company_name": "Blue Cross Blue Shield",
                "employer_group": "City Government",
                "member_name": "John Doe",
                "member_id": "ABC123456789",
                "group_number": "12345",
                "plan_name": "PPO Gold",
                "policy_holder_name": "John Doe",
                "relationship_to_holder": "self",
                "effective_date": date(2024, 1, 1),
                "expiration_date": date(2024, 12, 31),
                "status": InsuranceStatus.ACTIVE.value,
                "is_primary": True,
                "coverage_details": {
                    "deductible": 1000,
                    "copay_primary": 25,
                    "copay_specialist": 50,
                    "out_of_pocket_max": 5000
                },
                "contact_info": {
                    "phone": "(800) 555-BCBS",
                    "website": "https://bcbs.com"
                },
                "notes": "Primary medical insurance through employer"
            },
            {
                "insurance_type": InsuranceType.DENTAL.value,
                "company_name": "Delta Dental",
                "employer_group": "City Government",
                "member_name": "John Doe",
                "member_id": "DD987654321",
                "group_number": "54321",
                "plan_name": "Dental Plus",
                "policy_holder_name": "John Doe",
                "relationship_to_holder": "self",
                "effective_date": date(2024, 1, 1),
                "expiration_date": date(2024, 12, 31),
                "status": InsuranceStatus.ACTIVE.value,
                "is_primary": True,
                "coverage_details": {
                    "annual_max": 1500,
                    "preventive_coverage": "100%",
                    "basic_coverage": "80%",
                    "major_coverage": "50%"
                },
                "contact_info": {
                    "phone": "(800) 555-DELTA",
                    "website": "https://deltadental.com"
                }
            },
            {
                "insurance_type": InsuranceType.VISION.value,
                "company_name": "VSP Vision Care",
                "employer_group": "City Government",
                "member_name": "John Doe",
                "member_id": "VSP555666777",
                "group_number": "99999",
                "plan_name": "Vision Plus",
                "policy_holder_name": "John Doe",
                "relationship_to_holder": "self",
                "effective_date": date(2024, 1, 1),
                "expiration_date": date(2024, 12, 31),
                "status": InsuranceStatus.ACTIVE.value,
                "is_primary": True,
                "coverage_details": {
                    "exam_copay": 20,
                    "frame_allowance": 150,
                    "lens_coverage": "100%"
                },
                "contact_info": {
                    "phone": "(800) 555-VSP",
                    "website": "https://vsp.com"
                }
            }
        ]

        # Create insurance for the target patient (first patient) or all patients
        target_patients = [self.patients[0]] if self.target_patient_id else self.patients

        for i, patient in enumerate(target_patients):
            # Patient gets all insurance types when targeting specific patient, otherwise 1-3
            if self.target_patient_id:
                num_insurance = len(insurance_data)
            else:
                num_insurance = 1 + (i % 3)  # 1-3 insurance records

            for j in range(num_insurance):
                insurance_record = insurance_data[j % len(insurance_data)].copy()
                # Customize member name
                insurance_record["member_name"] = f"{patient.first_name} {patient.last_name}"
                insurance_record["policy_holder_name"] = f"{patient.first_name} {patient.last_name}"

                insurance = Insurance(
                    patient_id=patient.id,
                    **insurance_record
                )
                self.db.add(insurance)

        self.db.commit()
        logger.info("Created test insurance records")

    def create_user_tags(self):
        """Create test user tags"""
        logger.info("Creating test user tags")

        common_tags = [
            "chronic", "urgent", "routine", "follow-up", "screening",
            "cardiovascular", "diabetes", "respiratory", "mental health",
            "preventive", "acute", "surgery", "medication", "lab work"
        ]

        for user in self.users:
            # Get existing tags for this user
            existing_tags = set(
                tag.tag for tag in self.db.query(UserTag).filter(UserTag.user_id == user.id).all()
            )

            # Each user gets 5-8 common tags
            user_tags = common_tags[:5 + (user.id % 4)]
            for tag in user_tags:
                # Only add if tag doesn't already exist for this user
                if tag not in existing_tags:
                    user_tag = UserTag(
                        user_id=user.id,
                        tag=tag
                    )
                    self.db.add(user_tag)

        self.db.commit()
        logger.info("Created test user tags")

    def populate_all_data(self):
        """Populate all test data"""
        logger.info("Starting comprehensive test data population")

        # Step 1: Core entities
        self.create_users_and_patients()
        self.create_practitioners()
        self.create_pharmacies()

        # Step 2: Medical records
        self.create_conditions()
        self.create_medications()
        self.create_lab_results()
        self.create_allergies()
        self.create_procedures()
        self.create_treatments()
        self.create_immunizations()
        self.create_vital_signs()
        self.create_encounters()

        # Step 3: Supporting data
        self.create_emergency_contacts()
        self.create_family_history()
        self.create_insurance()
        self.create_user_tags()

        logger.info("✅ Test data population completed successfully")

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print summary of created test data"""
        print("\n" + "="*60)
        print("TEST DATA POPULATION SUMMARY")
        print("="*60)
        print(f"Users: {len(self.users)}")
        print(f"Patients: {len(self.patients)}")
        print(f"Practitioners: {len(self.practitioners)}")
        print(f"Pharmacies: {len(self.pharmacies)}")
        print("\nMedical Records Created:")
        print("- Medications, Lab Results, Conditions, Allergies")
        print("- Procedures, Treatments, Immunizations")
        print("- Vital Signs, Visit History (Encounters)")
        print("\nSupporting Data Created:")
        print("- Emergency Contacts, Family History")
        print("- Insurance Records, User Tags")
        print("\n" + "="*60)
        print("Ready for testing! You can now:")
        print("   - Login with any user (username/password123)")
        print("   - Admin user: admin/admin123")
        print("   - Explore all medical record types")
        print("   - Test search, filtering, and reporting features")
        print("="*60)


def main():
    """Main function to run test data population"""
    parser = argparse.ArgumentParser(description="Populate test data for Medical Records system")
    parser.add_argument(
        "--clear-first",
        action="store_true",
        help="Clear all existing data before populating (WARNING: Destructive!)"
    )
    parser.add_argument(
        "--user-id",
        type=int,
        help="Target specific user ID (requires --patient-id)"
    )
    parser.add_argument(
        "--patient-id",
        type=int,
        help="Target specific patient ID (requires --user-id)"
    )

    args = parser.parse_args()

    print("Medical Records Test Data Population Script")
    print("=" * 50)

    # Validate user and patient ID arguments
    if (args.user_id and not args.patient_id) or (args.patient_id and not args.user_id):
        print("Error: Both --user-id and --patient-id must be provided together")
        return 1

    if args.clear_first:
        print("WARNING: This will DELETE ALL existing data!")
        confirm = input("Type 'YES' to confirm data deletion: ")
        if confirm != "YES":
            print("Operation cancelled")
            return

    if args.user_id and args.patient_id:
        print(f"Targeting specific user ID: {args.user_id}, patient ID: {args.patient_id}")

    db_session = SessionLocal()
    try:
        populator = TestDataPopulator(db_session, args.user_id, args.patient_id)

        if args.clear_first:
            populator.clear_all_data()

        populator.populate_all_data()

        print("\nTest data population completed successfully!")

    except Exception as e:
        logger.error(f"Failed to populate test data: {e}")
        db_session.rollback()
        print(f"Error: {e}")
        return 1
    finally:
        db_session.close()

    return 0


if __name__ == "__main__":
    exit(main())