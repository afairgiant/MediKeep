from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)

from .base import Base, get_utc_now


class UserTotp(Base):
    """A user's authenticator-app secret. enabled_at is NULL until setup is confirmed."""

    __tablename__ = "user_totp"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Encrypted with a key derived from SECRET_KEY; unreadable after the key changes
    secret_encrypted = Column(Text, nullable=False)
    enabled_at = Column(DateTime, nullable=True)
    # Highest 30-second step accepted, so a code cannot be used twice
    last_used_step = Column(BigInteger, nullable=True)

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )


class UserBackupCode(Base):
    """A single-use recovery code, stored as a bcrypt hash."""

    __tablename__ = "user_backup_codes"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code_hash = Column(String(100), nullable=False)
    used_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    __table_args__ = (Index("idx_user_backup_codes_user_id", "user_id"),)
