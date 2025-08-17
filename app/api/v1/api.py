from fastapi import APIRouter

from app.api.v1 import admin
from app.api.v1.endpoints import (
    allergy,
    auth,
    condition,
    custom_reports,
    emergency_contact,
    encounter,
    entity_file,
    export,
    family_member,
    family_history_sharing,
    frontend_logs,
    immunization,
    insurance,
    invitations,
    lab_result,
    lab_result_file,
    medication,
    paperless,
    patients,
    patient_management,
    patient_sharing,
    pharmacy,
    practitioner,
    procedure,
    sso,
    system,
    treatment,
    users,
    utils,
    vitals,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(sso.router)  # SSO routes already have /auth/sso prefix
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])

# V1 Patient Management and Sharing
api_router.include_router(patient_management.router, prefix="/patient-management", tags=["v1-patient-management"])
api_router.include_router(patient_sharing.router, prefix="/patient-sharing", tags=["v1-patient-sharing"])

# V1.5 Family History Sharing and Invitations
api_router.include_router(family_history_sharing.router, prefix="/family-history-sharing", tags=["family-history-sharing"])
api_router.include_router(invitations.router, prefix="/invitations", tags=["invitations"])
api_router.include_router(
    lab_result.router, prefix="/lab-results", tags=["lab-results"]
)
api_router.include_router(
    lab_result_file.router, prefix="/lab-result-files", tags=["lab-result-files"]
)
api_router.include_router(
    entity_file.router, prefix="/entity-files", tags=["entity-files"]
)

# Medical record endpoints
api_router.include_router(encounter.router, prefix="/encounters", tags=["encounters"])
api_router.include_router(condition.router, prefix="/conditions", tags=["conditions"])
api_router.include_router(
    emergency_contact.router, prefix="/emergency-contacts", tags=["emergency-contacts"]
)
api_router.include_router(
    family_member.router, prefix="/family-members", tags=["family-members"]
)
api_router.include_router(
    immunization.router, prefix="/immunizations", tags=["immunizations"]
)
api_router.include_router(insurance.router, prefix="/insurances", tags=["insurance"])
api_router.include_router(procedure.router, prefix="/procedures", tags=["procedures"])
api_router.include_router(treatment.router, prefix="/treatments", tags=["treatments"])
api_router.include_router(allergy.router, prefix="/allergies", tags=["allergies"])
api_router.include_router(vitals.router, prefix="/vitals", tags=["vitals"])

# Healthcare provider endpoints
api_router.include_router(
    practitioner.router, prefix="/practitioners", tags=["practitioners"]
)
api_router.include_router(pharmacy.router, prefix="/pharmacies", tags=["pharmacies"])
api_router.include_router(
    medication.router, prefix="/medications", tags=["medications"]
)

# Frontend logging endpoints
api_router.include_router(
    frontend_logs.router, prefix="/frontend-logs", tags=["frontend-logs"]
)

# Export endpoints
api_router.include_router(export.router, prefix="/export", tags=["export"])

# Custom reports endpoints
api_router.include_router(custom_reports.router, prefix="/custom-reports", tags=["custom-reports"])

# Utils endpoints
api_router.include_router(utils.router)

# System endpoints
api_router.include_router(system.router, prefix="/system", tags=["system"])

# Paperless-ngx integration endpoints
api_router.include_router(paperless.router, prefix="/paperless", tags=["paperless"])

# Admin endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
