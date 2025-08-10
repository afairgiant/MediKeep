"""
Response model schema for APIException compatibility.

This module provides the ResponseModel that the APIException library expects,
imported from our core response models module.
"""

from app.core.response_models import ResponseModel

# Re-export for APIException compatibility
__all__ = ["ResponseModel"]