import os

from app.core.config import settings
from app.core.database import (
    check_database_connection,
    check_sequences_on_startup,
    create_default_user,
    database_migrations,
)
from app.core.datetime_utils import set_application_startup_time
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


async def startup_event():
    """Initialize database tables on startup"""
    # Record the actual application startup time
    set_application_startup_time()

    logger.info(
        "Application starting up",
        extra={
            "category": "app",
            "event": "application_startup",
            "version": settings.VERSION,
        },
    )

    # Initialize and validate timezone configuration
    from app.core.datetime_utils import get_facility_timezone

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
    
    # Activity tracking disabled - using manual endpoint logging instead
    # to prevent duplicate activity log entries
    logger.info("Activity tracking disabled - using manual endpoint logging")
    
    logger.info("Application startup completed")
