from typing import Optional

from sqlalchemy.orm import Session

from app.models.models import SystemSetting


class CRUDSystemSetting:
    """CRUD operations for SystemSetting"""

    def get_setting(self, db: Session, key: str) -> Optional[str]:
        """
        Get a system setting value by key.

        Args:
            db: Database session
            key: Setting key to retrieve

        Returns:
            Setting value as string, or None if not found
        """
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        return setting.value if setting else None

    def set_setting(self, db: Session, key: str, value: str) -> SystemSetting:
        """
        Set a system setting value. Creates new or updates existing.

        Args:
            db: Database session
            key: Setting key
            value: Setting value

        Returns:
            SystemSetting object
        """
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()

        if setting:
            # Update existing setting
            setting.value = value
        else:
            # Create new setting
            setting = SystemSetting(key=key, value=value)
            db.add(setting)

        db.commit()
        db.refresh(setting)
        return setting

    def delete_setting(self, db: Session, key: str) -> bool:
        """
        Delete a system setting by key.

        Args:
            db: Database session
            key: Setting key to delete

        Returns:
            True if deleted, False if not found
        """
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()

        if setting:
            db.delete(setting)
            db.commit()
            return True

        return False

    def get_all_settings(self, db: Session) -> dict[str, str]:
        """
        Get all system settings as a dictionary.

        Args:
            db: Database session

        Returns:
            Dictionary of key-value pairs
        """
        settings = db.query(SystemSetting).all()
        return {setting.key: setting.value for setting in settings}


# Create instance of the CRUD class
system_setting = CRUDSystemSetting()
