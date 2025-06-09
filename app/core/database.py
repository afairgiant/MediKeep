import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.models.models import Base
from app.core.logging_config import get_logger

# Initialize logger
logger = get_logger(__name__, "app")


class DatabaseConfig:
    def __init__(self):
        self.database_url = self._get_database_url()
        self.engine_kwargs = self._get_engine_kwargs()

    def _get_database_url(self) -> str:
        """Get database URL from environment or default to SQLite"""
        return os.getenv("DATABASE_URL", "sqlite:///./medical_records.db")

    def _get_engine_kwargs(self) -> dict:
        """Get engine configuration based on database type"""
        if self.database_url.startswith("sqlite"):
            return {
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
                "echo": False,
            }
        else:
            return {"pool_pre_ping": True, "pool_recycle": 300, "echo": False}


# Initialize database configuration
db_config = DatabaseConfig()
engine = create_engine(db_config.database_url, **db_config.engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
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


def get_db():
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
        logger.error(
            f"Database connection check failed: {e}",
            extra={
                "category": "app",
                "event": "database_connection_check_failed",
                "error": str(e),
            },
        )
        return False


def create_default_user():
    """Create a default user if none exists"""
    from app.services.auth import AuthService

    db = SessionLocal()
    try:
        if not AuthService.get_user_by_username(db, "admin"):
            AuthService.create_user(
                db, username="admin", password="admin123", is_superuser=True
            )
            print("Default admin user created.")
        else:
            print("Default admin user already exists.")
    finally:
        db.close()
