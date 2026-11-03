"""
FHIR resource mappers.

Registry keyed by FHIR resourceType. Mappers are added by later changes; the
framework runs with none registered and reports every resource as unsupported.
"""

from typing import Dict, List, Optional

from .base_mapper import BaseResourceMapper, MappedRecord


class ResourceMapperRegistry:
    """Registry for FHIR resource mappers keyed by resourceType."""

    def __init__(self):
        self._mappers: Dict[str, BaseResourceMapper] = {}

    def register(self, mapper: BaseResourceMapper):
        """Register a mapper by its RESOURCE_TYPE."""
        self._mappers[mapper.RESOURCE_TYPE] = mapper

    def unregister(self, resource_type: str):
        """Remove the mapper for a resourceType, if any."""
        self._mappers.pop(resource_type, None)

    def get_mapper(self, resource_type: str) -> Optional[BaseResourceMapper]:
        """Get the mapper for a resourceType."""
        return self._mappers.get(resource_type)

    def supported_types(self) -> List[str]:
        """Return the registered resourceTypes."""
        return list(self._mappers.keys())


# Global registry instance
resource_mapper_registry = ResourceMapperRegistry()


__all__ = [
    "BaseResourceMapper",
    "MappedRecord",
    "ResourceMapperRegistry",
    "resource_mapper_registry",
]
