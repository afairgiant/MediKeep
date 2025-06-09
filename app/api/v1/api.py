from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    patients,
    lab_result_file,
    lab_result,
    encounter,
    condition,
    immunization,
    procedure,
    treatment,
    allergy,
    practitioner,
    medication,
    frontend_logs,
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
    immunization.router, prefix="/immunizations", tags=["immunizations"]
)
api_router.include_router(procedure.router, prefix="/procedures", tags=["procedures"])
api_router.include_router(treatment.router, prefix="/treatments", tags=["treatments"])
api_router.include_router(allergy.router, prefix="/allergies", tags=["allergies"])

# Healthcare provider endpoints
api_router.include_router(
    practitioner.router, prefix="/practitioners", tags=["practitioners"]
)
api_router.include_router(
    medication.router, prefix="/medications", tags=["medications"]
)

# Frontend logging endpoints
api_router.include_router(
    frontend_logs.router, prefix="/frontend-logs", tags=["frontend-logs"]
)
