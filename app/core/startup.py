import os

from app.core import auth_mode
from app.core.config import settings
from app.core.database.database import (
    check_database_connection,
    check_sequences_on_startup,
    create_default_user,
    database_migrations,
)
from app.core.database.migrations import run_startup_data_migrations
from app.core.events import get_event_registry, setup_event_system
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.datetime_utils import set_application_startup_time
from app.services.notification_handlers import create_notification_handler

logger = get_logger(__name__, "app")


def _emit_auth_mode_warnings(db=None):
    """Log the auth-mode configurations that are legal but worth saying out loud.

    Called from both startup exits. Pass a session to include the checks that need
    one; the SKIP_MIGRATIONS path has no database and correctly passes none.
    """
    for event, message in auth_mode.warnings(db):
        logger.warning(
            message,
            extra={LogFields.CATEGORY: "app", LogFields.EVENT: event},
        )


def _log_effective_auth_mode():
    """Log the authentication configuration the instance actually came up with.

    Provider type only - never the client id or secret.
    """
    values = {
        "sso_enabled": settings.SSO_ENABLED,
        "sso_provider_type": settings.SSO_PROVIDER_TYPE,
        "sso_only_mode": settings.SSO_ONLY_MODE,
        "sso_auto_redirect": settings.SSO_AUTO_REDIRECT,
        "allow_user_registration": settings.ALLOW_USER_REGISTRATION,
    }
    # Values in the message: the console formatter only appends extras at WARNING+.
    summary = " ".join(f"{name}={value}" for name, value in values.items())

    logger.info(
        f"Authentication mode: {summary}",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "auth_mode_configured",
            **values,
        },
    )


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

    # Validate the authentication-mode configuration before anything else runs.
    # This is deliberately ahead of the database check and the SKIP_MIGRATIONS
    # early return: the misconfiguration it catches is a compose-file typo, which
    # must fail loudly whether or not the database happens to be reachable.
    try:
        settings.validate_auth_mode_config()
    except ValueError as e:
        error_msg = f"STARTUP FAILED: {e}"
        logger.error(
            error_msg,
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "auth_mode_config_invalid",
                LogFields.ERROR: str(e),
            },
        )
        raise RuntimeError(str(e)) from e

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
        # This path never reaches load_persisted_settings(), so the warning site
        # further down is unreachable from here. Emitting now is not a compromise:
        # with no database there is no stored ALLOW_USER_REGISTRATION that could
        # override the env value, so the env value is the one in force.
        _emit_auth_mode_warnings()
        _log_effective_auth_mode()
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

    # Load admin-toggleable settings persisted in system_settings (e.g.
    # allow_user_registration, backup/trash retention). The env-var defaults
    # from app.core.config.Settings were already loaded at import time; any
    # persisted value overrides them here.
    # The warnings below are emitted here, and not beside validate_auth_mode_config()
    # above, because they read ALLOW_USER_REGISTRATION - admin-toggleable and persisted
    # in system_settings, so the stored value only takes effect at
    # load_persisted_settings(). Warning any earlier would report on a value that is not
    # in force. A toggle flipped at runtime is not covered here - the admin settings
    # endpoint warns at the toggle. The session stays open past the load: warnings need it.
    db = None
    try:
        from app.core.persisted_settings import load_persisted_settings

        db = SessionLocal()
        load_persisted_settings(db)
    except Exception as e:
        logger.warning(f"Could not load persisted admin settings: {e}")
        # Non-fatal - app falls back to env-var defaults already in memory
    try:
        _emit_auth_mode_warnings(db)
        _log_effective_auth_mode()
    finally:
        if db is not None:
            db.close()

    # Initialize standardized tests from LOINC
    try:
        from app.core.utils.test_initialization import ensure_tests_initialized

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

    # Initialize auto-backup scheduler
    try:
        from app.services.backup_scheduler_service import BackupSchedulerService

        scheduler = BackupSchedulerService.get_instance()
        await scheduler.start()
    except Exception as e:
        logger.warning(f"Could not initialize auto-backup scheduler: {e}")
        # Non-fatal - app can still function without auto-backups

    # Initialize medication reminder scheduler
    try:
        from app.services.medication_reminder_scheduler import (
            MedicationReminderSchedulerService,
        )

        med_scheduler = MedicationReminderSchedulerService.get_instance()
        await med_scheduler.start()
    except Exception as e:
        logger.warning(f"Could not initialize medication reminder scheduler: {e}")
        # Non-fatal - app still functions without reminders

    logger.info("Application startup completed")
