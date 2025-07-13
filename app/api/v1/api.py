from fastapi import APIRouter

from app.api.v1 import admin
from app.api.v1.endpoints import (
    allergy,
    auth,
    condition,
    emergency_contact,
    encounter,
    export,
    family_member,
    frontend_logs,
    immunization,
    lab_result,
    lab_result_file,
    medication,
    patients,
    pharmacy,
    practitioner,
    procedure,
    system,
    treatment,
    users,
    utils,
    vitals,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(
    lab_result.router, prefix="/lab-results", tags=["lab-results"]
)
api_router.include_router(
    lab_result_file.router, prefix="/lab-result-files", tags=["lab-result-files"]
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

# Utils endpoints
api_router.include_router(utils.router)

# System endpoints
api_router.include_router(system.router, prefix="/system", tags=["system"])

# Admin endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
