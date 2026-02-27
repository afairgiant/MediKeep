"""
Base class for vitals CSV parsers.
Each device/platform (Dexcom, Libre, etc.) will have its own parser implementation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class VitalsReading:
    """A single parsed vitals reading from a CSV import."""

    recorded_date: datetime
    blood_glucose: Optional[float] = None
    heart_rate: Optional[int] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    temperature: Optional[float] = None
    device_used: Optional[str] = None
    import_source: Optional[str] = None
    notes: Optional[str] = None
    source_row: int = 0


@dataclass
class VitalsParseResult:
    """Result of parsing a vitals CSV file."""

    readings: List[VitalsReading] = field(default_factory=list)
    device_name: str = ""
    total_rows_processed: int = 0
    skipped_rows: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None


class BaseVitalsParser(ABC):
    """Base class for vitals CSV parsers."""

    DEVICE_NAME = "Generic"
    IMPORT_SOURCE_KEY = "generic"

    @abstractmethod
    def parse(self, csv_content: str) -> VitalsParseResult:
        """
        Parse CSV content into vitals readings.

        Args:
            csv_content: Raw CSV file content as string

        Returns:
            VitalsParseResult with parsed readings and metadata
        """

    @abstractmethod
    def validate_format(self, csv_content: str) -> bool:
        """
        Check if the CSV content matches this parser's expected format.

        Args:
            csv_content: Raw CSV file content as string

        Returns:
            True if this parser can handle the format
        """
