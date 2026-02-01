"""
Test Library Synchronization Service

Provides functionality to sync the test library and auto-link existing
LabTestComponent records to canonical test names.

This service enables one-time migration to standardize test naming across
the application using the canonical test library as the source of truth.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.crud.system_setting import system_setting
from app.models.models import LabTestComponent

logger = get_logger(__name__, "app")


def get_utc_now():
    """Get the current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)


class TestLibrarySyncService:
    """
    Service for auto-linking LabTestComponent records to canonical test names.

    Provides individual component matching, patient batch processing,
    and one-time database migration.
    """

    MIGRATION_KEY = "canonical_test_migration_completed"
    BATCH_SIZE = 100

    def auto_link_component(self, component: LabTestComponent) -> Optional[str]:
        """
        Attempt to match a LabTestComponent to a canonical test name.
        Also updates the category from the test library if available.

        Does NOT update the database. Caller is responsible for persistence.

        Returns:
            Canonical test name if match found, None otherwise
        """
        from app.services.canonical_test_matching import canonical_test_matching

        try:
            canonical_name = canonical_test_matching.find_canonical_match(
                component.test_name
            )

            if canonical_name:
                # Also set category from the test library
                test_info = canonical_test_matching.get_test_info(canonical_name)
                if test_info and test_info.get("category"):
                    component.category = test_info["category"]

                logger.debug(
                    "Found canonical match",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "component_canonical_linked",
                        LogFields.RECORD_ID: component.id,
                        "original_name": component.test_name,
                        "canonical_name": canonical_name,
                        "test_category": test_info.get("category") if test_info else None,
                    },
                )

            return canonical_name

        except Exception as e:
            logger.error(
                "Error matching component to canonical test",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "component_canonical_link_error",
                    LogFields.RECORD_ID: component.id,
                    "test_name": component.test_name,
                    LogFields.ERROR: str(e),
                },
            )
            return None

    def auto_link_all_for_patient(self, db: Session, patient_id: int) -> dict:
        """
        Auto-link all LabTestComponent records for a patient to canonical names.

        Returns:
            Dictionary with stats: {"processed": int, "linked": int, "unlinked": int}
        """
        try:
            components = (
                db.query(LabTestComponent)
                .join(LabTestComponent.lab_result)
                .filter(
                    and_(
                        LabTestComponent.canonical_test_name.is_(None),
                        LabTestComponent.lab_result.has(patient_id=patient_id),
                    )
                )
                .all()
            )

            total_linked = 0

            for component in components:
                canonical_name = self.auto_link_component(component)
                if canonical_name:
                    component.canonical_test_name = canonical_name
                    total_linked += 1

            db.commit()

            total_processed = len(components)
            logger.info(
                "Completed auto-link for patient",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "patient_components_autolinked",
                    LogFields.PATIENT_ID: patient_id,
                    "processed": total_processed,
                    "linked": total_linked,
                    "unlinked": total_processed - total_linked,
                },
            )

            return {
                "processed": total_processed,
                "linked": total_linked,
                "unlinked": total_processed - total_linked,
            }

        except Exception as e:
            logger.error(
                "Failed to auto-link components for patient",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "patient_components_autolink_failed",
                    LogFields.PATIENT_ID: patient_id,
                    LogFields.ERROR: str(e),
                },
            )
            db.rollback()
            raise

    def run_one_time_migration(self, db: Session) -> dict:
        """
        Run one-time migration to auto-link all existing LabTestComponent records.

        Checks SystemSetting to ensure migration runs only once.

        Returns:
            {"skipped": True, "reason": str} if already completed,
            {"skipped": False, "processed": int, "linked": int, "unlinked": int} otherwise
        """
        try:
            migration_status = system_setting.get_setting(db, self.MIGRATION_KEY)

            if migration_status and migration_status.startswith("true"):
                logger.debug("Canonical test migration already completed", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_migration_skipped",
                })
                return {"skipped": True, "reason": "already_completed"}

            total_components = (
                db.query(LabTestComponent)
                .filter(LabTestComponent.canonical_test_name.is_(None))
                .count()
            )

            logger.info(
                "Starting canonical test migration",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_migration_started",
                    LogFields.COUNT: total_components,
                },
            )

            total_processed = 0
            total_linked = 0

            # Process in batches without offset - the filter on canonical_test_name.is_(None)
            # naturally excludes already-processed records after each commit
            while True:
                batch = (
                    db.query(LabTestComponent)
                    .filter(LabTestComponent.canonical_test_name.is_(None))
                    .limit(self.BATCH_SIZE)
                    .all()
                )

                if not batch:
                    break

                for component in batch:
                    canonical_name = self.auto_link_component(component)
                    if canonical_name:
                        component.canonical_test_name = canonical_name
                        total_linked += 1
                    total_processed += 1

                db.commit()

                if total_components > self.BATCH_SIZE:
                    progress = round((total_processed / total_components) * 100, 2)
                    logger.debug(
                        "Migration progress",
                        extra={
                            LogFields.CATEGORY: "app",
                            LogFields.EVENT: "canonical_migration_progress",
                            "processed": total_processed,
                            "progress": progress,
                        },
                    )

            timestamp = get_utc_now().isoformat()
            system_setting.set_setting(
                db,
                self.MIGRATION_KEY,
                f"true (completed at {timestamp})",
            )

            logger.info(
                "Completed canonical test migration",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_migration_completed",
                    "processed": total_processed,
                    "linked": total_linked,
                    "unlinked": total_processed - total_linked,
                },
            )

            return {
                "skipped": False,
                "processed": total_processed,
                "linked": total_linked,
                "unlinked": total_processed - total_linked,
            }

        except Exception as e:
            logger.error(
                "Failed canonical test migration",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_migration_failed",
                    LogFields.ERROR: str(e),
                },
            )
            db.rollback()
            raise


# Create singleton instance
test_library_sync = TestLibrarySyncService()
