from datetime import datetime, timezone

from sqlalchemy.orm import declarative_base


def get_utc_now():
    """Get the current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)


Base = declarative_base()
