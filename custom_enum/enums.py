"""
Custom enums for APIException compatibility.

This module provides the enums that the APIException library expects,
imported from our core response models module.
"""

from app.core.response_models import (
    ExceptionStatus,
    BaseExceptionCode,
    ExceptionCode
)

# Re-export for APIException compatibility
__all__ = [
    "ExceptionStatus",
    "BaseExceptionCode", 
    "ExceptionCode"
]