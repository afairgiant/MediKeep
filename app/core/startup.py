import os

from app.core.config import settings
from app.core.database.database import (
    check_database_connection,
    check_sequences_on_startup,
    create_default_user,
    database_migrations,
)
from app.core.utils.datetime_utils import set_application_startup_time
from app.core.logging.config import get_logger
from app.core.utils.activity_tracker import initialize_activity_tracking
from app.core.database.migrations import run_startup_data_migrations
from app.core.events import get_event_registry, setup_event_system
from app.core.logging.constants import LogFields
from app.services.notification_handlers import create_notification_handler

logger = get_logger(__name__, "app")


async def startup_event():
    """Initialize database tables on startup"""
    # Record the actual application startup time
    set_application_startup_time()

    logger.info(
        "Application starting up",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "application_startup",
            "version": settings.VERSION,
        },
    )

    # Initialize the event system (event registry and bus)
    event_bus = setup_event_system()
    logger.info("Event system initialized")

    # Subscribe notification handler to all registered events
    from app.core.database.database import SessionLocal

    registry = get_event_registry()
    notification_handler = create_notification_handler(SessionLocal)

    event_count = 0
    for event_metadata in registry.all():
        event_bus.subscribe(event_metadata.event_type, notification_handler)
        event_count += 1

    logger.info(
        "Notification handler subscribed to events",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "event_subscriptions_initialized",
            "event_count": event_count,
        },
    )

    # Initialize and validate timezone configuration
    from app.core.utils.datetime_utils import get_facility_timezone

    try:
        tz = get_facility_timezone()
        logger.info(f"Timezone configured successfully: {tz}")
    except Exception as e:
        logger.warning(f"Timezone configuration warning: {e}, using UTC fallback")

    # Skip database operations if in test mode
    skip_migrations = os.getenv("SKIP_MIGRATIONS", "false").lower() == "true"

    if skip_migrations:
        logger.info("⏭️ Skipping database operations (test mode)")
        logger.info("Application startup completed (test mode)")
        return

    # Check if database connection is valid
    db_check_result = check_database_connection()

    if not db_check_result:
        error_msg = "STARTUP FAILED: Cannot connect to database"

        # Provide helpful troubleshooting information
        if settings.DATABASE_URL.startswith("postgresql"):
            error_msg += f"\n   Database URL: {settings.DATABASE_URL}"
            error_msg += "\n   💡 Possible solutions:"
            error_msg += "\n      • Start your PostgreSQL database container: docker-compose up -d postgres"
            error_msg += (
                "\n      • Check if PostgreSQL is running on the specified host/port"
            )
            error_msg += "\n      • Verify database credentials in your .env file"
        elif settings.DATABASE_URL.startswith("sqlite"):
            error_msg += (
                f"\n   Database file: {settings.DATABASE_URL.replace('sqlite:///', '')}"
            )
            error_msg += "\n   💡 Check if the SQLite database file path is accessible"

        logger.error(error_msg)

        # Instead of sys.exit(1), raise a more informative startup error
        raise RuntimeError(
            "Database connection failed. See logs above for troubleshooting steps."
        )

        logger.info("Database connection established")

    # Run database migrations
    migration_success = database_migrations()
    if not migration_success:
        error_msg = "STARTUP FAILED: Database migrations failed"
        error_msg += "\n   💡 Possible solutions:"
        error_msg += "\n      • Check if the database schema is compatible"
        error_msg += "\n      • Verify Alembic migration files are present"
        error_msg += "\n      • Ensure proper database permissions"

        logger.error(error_msg)

        # Instead of sys.exit(1), raise a more informative startup error
        raise RuntimeError("Database migrations failed. See logs above for details.")

    # Create default user if not exists
    create_default_user()
    await check_sequences_on_startup()
    
    # Run data migrations (after users/database setup is complete)
    run_startup_data_migrations()

    # Initialize standardized tests from LOINC
    try:
        from app.core.utils.test_initialization import ensure_tests_initialized
        from app.core.database.database import SessionLocal

        db = SessionLocal()
        try:
            ensure_tests_initialized(db)
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Could not initialize standardized tests: {e}")
        # Non-fatal - app can still function without pre-loaded tests

    # Initialize activity tracking
    # NOTE: Automatic activity tracking disabled to prevent double logging
    # Manual activity logging is used instead via app.api.activity_logging
    logger.info("Activity tracking initialization skipped (using manual logging)")

    logger.info("Application startup completed")
