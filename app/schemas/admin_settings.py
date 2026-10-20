"""
Schemas for the admin settings API.
"""

from typing import Literal, Optional, Union

from pydantic import BaseModel, StrictBool, StrictInt

SettingValue = Union[StrictBool, StrictInt]


class SettingState(BaseModel):
    """One persisted admin setting and where its current value comes from."""

    value: SettingValue
    source: Literal["saved", "env", "default"]
    fallback: SettingValue
    fallback_source: Literal["env", "default"]
    min: Optional[int] = None
    max: Optional[int] = None


class DeploymentValue(BaseModel):
    """A read-only value set in the deployment files."""

    name: str
    value: Union[bool, str]


class SettingWarning(BaseModel):
    code: str
    message: str


class AdminSettingsResponse(BaseModel):
    settings: dict[str, SettingState]
    deployment: list[DeploymentValue]


class AdminSettingsUpdate(BaseModel):
    """Changed settings only; ``null`` removes the saved value."""

    changes: dict[str, Optional[SettingValue]]


class AdminSettingsUpdateResponse(BaseModel):
    settings: dict[str, SettingState]
    updated: list[str]
    warnings: list[SettingWarning]
