import os
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.core.logging_config import get_logger
from app.models.models import Base

# Initialize logger
logger = get_logger(__name__, "app")

# Initialize settings
settings = Settings()


class DatabaseConfig:
    def __init__(self):
        self.database_url = self._get_database_url()
        self.engine_kwargs = self._get_engine_kwargs()

    def _get_database_url(self) -> str:
        """Get database URL from settings configuration"""
        if not settings.DATABASE_URL:
            raise ValueError(
                "DATABASE_URL is not set in the settings. Please configure it."
            )
        return settings.DATABASE_URL

    def _get_engine_kwargs(self) -> dict:
        """Get engine configuration based on database type"""
        if self.database_url.startswith("sqlite"):
            return {
                "connect_args": {
                    "check_same_thread": False,
                    "timeout": 30,  # Increased timeout for busy database
                    "isolation_level": None,  # Enable autocommit mode
                },
                "poolclass": StaticPool,
                "echo": False,
            }
        elif self.database_url.startswith("postgresql"):
            return {
                "pool_pre_ping": True,
                "pool_recycle": 1800,
                "pool_size": 10,
                "max_overflow": 20,
                "echo": False,
            }
        else:
            return {"pool_pre_ping": True, "pool_recycle": 300, "echo": False}


# Initialize database configuration
db_config = DatabaseConfig()

# Create engine
engine = create_engine(db_config.database_url, **db_config.engine_kwargs)

# For SQLite databases, set up WAL mode and other optimizations
if db_config.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Set SQLite pragmas for better concurrency"""
        cursor = dbapi_connection.cursor()
        # Enable WAL mode for better concurrent access
        cursor.execute("PRAGMA journal_mode=WAL")
        # Set busy timeout (30 seconds)
        cursor.execute("PRAGMA busy_timeout=30000")
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys=ON")
        # Optimize SQLite performance
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA temp_store=memory")
        cursor.execute("PRAGMA mmap_size=268435456")  # 256MB
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables() -> None:
    """Create all tables in the database"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info(
            "Database tables created successfully",
            extra={"category": "app", "event": "database_tables_created"},
        )
    except Exception as e:
        logger.error(
            f"Failed to create database tables: {e}",
            extra={
                "category": "app",
                "event": "database_tables_creation_failed",
                "error": str(e),
            },
        )
        raise


def drop_tables():
    """Drop all tables in the database"""
    Base.metadata.drop_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Get a new database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection():
    """Check if the database connection is valid"""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info(
            "Database connection check successful",
            extra={"category": "app", "event": "database_connection_check_success"},
        )
        return True
    except Exception as e:
        # Log detailed error information for troubleshooting
        error_type = type(e).__name__
        error_details = f"Database connection check failed ({error_type}): {e}"

        # Add database-specific troubleshooting hints
        if (
            "could not connect to server" in str(e).lower()
            or "connection refused" in str(e).lower()
        ):
            error_details += (
                "\n   🔍 This typically means the database server is not running"
            )
        elif (
            "authentication failed" in str(e).lower()
            or "password authentication failed" in str(e).lower()
        ):
            error_details += "\n   🔍 This indicates incorrect database credentials"
        elif "database" in str(e).lower() and "does not exist" in str(e).lower():
            error_details += "\n   🔍 The specified database does not exist"
        elif "timeout" in str(e).lower():
            error_details += "\n   🔍 Database connection timeout - server may be slow or unreachable"

        logger.error(
            error_details,
            extra={
                "category": "app",
                "event": "database_connection_check_failed",
                "error": str(e),
                "error_type": error_type,
            },
        )
        return False


def create_default_user():
    """Create a default admin user only if NO admin users exist (fresh installation)"""
    from app.crud.user import user
    from app.services.auth import AuthService

    db = SessionLocal()
    try:
        # Check if ANY admin users exist in the system
        admin_count = user.get_admin_count(db)

        if admin_count == 0:
            # No admin users exist - create default admin
            AuthService.create_user(
                db, username="admin", password="admin123", is_superuser=True
            )
            print("✅ Fresh installation detected - Default admin user created")
            print("   Username: admin, Password: admin123")
            print("   🔐 Please change the default password after first login!")
        else:
            print(
                f"Admin users already exist ({admin_count} found) - skipping default user creation"
            )
    finally:
        db.close()


async def check_sequences_on_startup() -> None:
    """Check and fix sequence synchronization on application startup"""
    if not getattr(settings, "SEQUENCE_CHECK_ON_STARTUP", False):
        return

    try:
        from app.scripts.sequence_monitor import SequenceMonitor

        monitor = SequenceMonitor()

        logger.info("Checking database sequences on startup")
        results = monitor.monitor_all_sequences(
            auto_fix=getattr(settings, "SEQUENCE_AUTO_FIX", False)
        )

        if results.get("out_of_sync_tables"):
            if getattr(settings, "SEQUENCE_AUTO_FIX", False):
                logger.info(
                    f"✅ Auto-fixed {len(results.get('fixed_tables', []))} sequence issues"
                )
            else:
                logger.warning(
                    f"⚠️  Found {len(results['out_of_sync_tables'])} sequence issues"
                )
        else:
            logger.info("✅ All database sequences are synchronized")

    except ImportError:
        logger.info("SequenceMonitor not available - skipping sequence check")
    except Exception as e:
        logger.error(f"❌ Failed to check sequences on startup: {e}")


def database_migrations() -> bool:
    """Run database migrations using Alembic"""
    try:
        import subprocess
        import sys

        logger.info("🔄 Running database migrations...")

        # Get project root directory (go up 3 levels from app/core/database.py)
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

        # Use the current Python executable (from virtual environment)
        python_executable = sys.executable

        result = subprocess.run(
            [
                python_executable,
                "-m",
                "alembic",
                "-c",
                "alembic/alembic.ini",
                "upgrade",
                "head",
            ],
            cwd=project_root,  # Project root
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            logger.info("✅ Database migrations completed successfully")
            if result.stdout:
                logger.debug(f"Migration output: {result.stdout}")
            return True
        else:
            logger.error(f"❌ Migration failed with return code {result.returncode}")
            logger.error(f"Migration stderr: {result.stderr}")
            if result.stdout:
                logger.error(f"Migration stdout: {result.stdout}")
            return False
    except FileNotFoundError as e:
        logger.error(f"❌ Alembic not found. Make sure it's installed. Error: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to run migrations: {e}")
        import traceback

        logger.error(f"Full traceback: {traceback.format_exc()}")
        return False
