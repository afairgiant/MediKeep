from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    column,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class ReportTemplate(Base):
    """
    Represents a custom report template for generating medical reports.
    Allows users to save report configurations for reuse and sharing.
    """

    __tablename__ = "report_templates"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Template information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Report configuration stored as JSON
    selected_records = Column(JSON, nullable=False)  # Record selections and filters
    report_settings = Column(
        JSON, nullable=False, default={}
    )  # UI preferences, sorting, grouping

    # Sharing and visibility
    is_public = Column(Boolean, nullable=False, default=False)
    shared_with_family = Column(Boolean, nullable=False, default=False)

    # Soft delete
    is_active = Column(Boolean, nullable=False, default=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Table Relationships
    user = orm_relationship("User")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="unique_user_template_name"),
        Index("idx_report_template_user_id", "user_id"),
        Index(
            "idx_report_template_is_active",
            "is_active",
            postgresql_where=(column("is_active") == True),
        ),
        Index(
            "idx_report_template_shared_family",
            "shared_with_family",
            postgresql_where=(column("shared_with_family") == True),
        ),
        Index(
            "idx_report_template_selected_records",
            "selected_records",
            postgresql_using="gin",
        ),
    )


class ReportGenerationAudit(Base):
    """
    Audit table for tracking report generation activities.
    Helps monitor system usage and performance.
    """

    __tablename__ = "report_generation_audit"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Report details
    report_type = Column(
        String(50), nullable=False
    )  # 'custom_report', 'full_export', etc.
    categories_included = Column(JSON, nullable=True)  # Array of category names (stored as JSON for SQLite compatibility)
    total_records = Column(Integer, nullable=True)

    # Performance metrics
    generation_time_ms = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    # Status tracking
    status = Column(
        String(20), nullable=False, default="success"
    )  # success, failed, timeout
    error_details = Column(Text, nullable=True)

    # Audit timestamp
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User")

    # Indexes for performance
    __table_args__ = (
        Index("idx_report_audit_user_created", "user_id", "created_at"),
        Index("idx_report_audit_status", "status"),
        Index("idx_report_audit_created_at", "created_at"),
    )
