"""
FHIR resource mappers.

Registry keyed by FHIR resourceType. Resource types without a mapper are
reported as unsupported by the import preview.
"""

from typing import Dict, List, Optional

from .allergy_mapper import AllergyMapper
from .base_mapper import BaseResourceMapper, MappedRecord
from .condition_mapper import ConditionMapper
from .medication_mapper import MedicationRequestMapper, MedicationStatementMapper


class ResourceMapperRegistry:
    """Registry for FHIR resource mappers keyed by resourceType."""

    def __init__(self):
        """Create the registry with the built-in mappers."""
        self._mappers: Dict[str, BaseResourceMapper] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(ConditionMapper())
        self.register(AllergyMapper())
        self.register(MedicationStatementMapper())
        self.register(MedicationRequestMapper())

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
    "AllergyMapper",
    "BaseResourceMapper",
    "ConditionMapper",
    "MappedRecord",
    "MedicationRequestMapper",
    "MedicationStatementMapper",
    "ResourceMapperRegistry",
    "resource_mapper_registry",
]
