from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)

from .base import Base, get_utc_now


class EntityFile(Base):
    """
    Generic file management for all entity types.
    Supports lab-results, insurance, visits, procedures, and future entity types.
    """

    __tablename__ = "entity_files"

    id = Column(Integer, primary_key=True)
    entity_type = Column(
        String(50), nullable=False
    )  # 'lab-result', 'insurance', 'visit', 'procedure'
    entity_id = Column(Integer, nullable=False)  # Foreign key to the entity
    file_name = Column(String(255), nullable=False)  # Original filename
    file_path = Column(String(500), nullable=False)  # Path to file on server
    file_type = Column(String(100), nullable=False)  # MIME type or extension
    file_size = Column(Integer, nullable=True)  # Size in bytes
    description = Column(Text, nullable=True)  # Optional description
    category = Column(
        String(100), nullable=True
    )  # File category (result, report, card, etc.)
    uploaded_at = Column(DateTime, nullable=False)  # Upload timestamp

    # Storage backend tracking
    storage_backend = Column(
        String(20), default="local", nullable=False
    )  # 'local' or 'paperless'
    paperless_document_id = Column(
        String(255), nullable=True
    )  # ID in paperless-ngx system
    paperless_task_uuid = Column(
        String(255), nullable=True
    )  # UUID of the task in paperless-ngx system
    sync_status = Column(
        String(20), default="synced", nullable=False
    )  # 'synced', 'pending', 'processing', 'failed', 'missing'
    last_sync_at = Column(DateTime, nullable=True)  # Last successful sync timestamp

    created_at = Column(DateTime, nullable=False, default=get_utc_now)
    updated_at = Column(
        DateTime, nullable=False, default=get_utc_now, onupdate=get_utc_now
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_entity_type_id", "entity_type", "entity_id"),
        Index("idx_category", "category"),
        Index("idx_uploaded_at", "uploaded_at"),
        Index("idx_created_at", "created_at"),
        Index("idx_storage_backend", "storage_backend"),
        Index("idx_paperless_document_id", "paperless_document_id"),
        Index("idx_sync_status", "sync_status"),
    )


class BackupRecord(Base):
    """
    Represents a backup record for tracking backup operations.
    """

    __tablename__ = "backup_records"

    id = Column(Integer, primary_key=True)
    backup_type = Column(String, nullable=False)  # 'full', 'database', 'files'
    status = Column(String, nullable=False)  # 'created', 'failed', 'verified'
    file_path = Column(String, nullable=False)  # Path to the backup file
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    size_bytes = Column(Integer, nullable=True)  # Size of backup file in bytes
    description = Column(Text, nullable=True)  # Optional description

    # Optional metadata
    compression_used = Column(Boolean, default=False, nullable=False)
    checksum = Column(String, nullable=True)  # File checksum for integrity verification
