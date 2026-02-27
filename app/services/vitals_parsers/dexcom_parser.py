"""
Dexcom Clarity CSV parser.

Parses the CSV export from Dexcom Clarity app which contains CGM
(continuous glucose monitor) readings taken every 5 minutes.

CSV format:
- Row 1: Column headers
- Rows 2-4: Metadata (patient name, device info) - skipped
- Row 5+: Data rows
- Column A (Index): Row number
- Column B (Timestamp): Date/time of reading (e.g., "2025-02-23T00:04:27")
- Column C (Event Type): "EGV" for glucose readings, also "Calibration", "Insulin", etc.
- Column H (Glucose Value): mg/dL value, or "Low"/"High" for out-of-range
"""

import csv
import io
from datetime import datetime
from typing import Optional

from app.core.logging.config import get_logger

from .base_parser import BaseVitalsParser, VitalsParseResult, VitalsReading

logger = get_logger(__name__, "app")

# Glucose bounds for "Low"/"High" text values
GLUCOSE_LOW_VALUE = 40.0
GLUCOSE_HIGH_VALUE = 400.0
GLUCOSE_MIN = 20.0
GLUCOSE_MAX = 800.0


class DexcomParser(BaseVitalsParser):
    """Parser for Dexcom Clarity CSV exports."""

    DEVICE_NAME = "Dexcom Clarity"
    IMPORT_SOURCE_KEY = "dexcom_clarity"

    def validate_format(self, csv_content: str) -> bool:
        """Check if content looks like a Dexcom Clarity CSV."""
        try:
            lines = csv_content.strip().split("\n")
            if len(lines) < 2:
                return False
            header = lines[0].lower()
            return "timestamp" in header and "event type" in header
        except Exception:
            return False

    def parse(self, csv_content: str) -> VitalsParseResult:
        """Parse Dexcom Clarity CSV into vitals readings."""
        result = VitalsParseResult(device_name=self.DEVICE_NAME)

        try:
            reader = csv.reader(io.StringIO(csv_content))
            rows = list(reader)
        except csv.Error as e:
            result.errors.append(f"Failed to parse CSV: {e}")
            return result

        if len(rows) < 2:
            result.errors.append("CSV file is empty or has no data rows")
            return result

        # Build column index map from header row
        header = rows[0]
        col_map = {col.strip().lower(): idx for idx, col in enumerate(header)}

        timestamp_col = col_map.get("timestamp (yyyy-mm-ddthh:mm:ss)") or col_map.get("timestamp")
        event_type_col = col_map.get("event type")
        glucose_col = (
            col_map.get("glucose value (mg/dl)")
            or col_map.get("glucose value")
        )

        if timestamp_col is None or event_type_col is None or glucose_col is None:
            result.errors.append(
                "Missing required columns. Expected: Timestamp, Event Type, Glucose Value"
            )
            return result

        # Skip metadata rows (rows 1-3 after header are typically patient info)
        # Detect them: they have non-EGV event types or the Index column is empty/metadata
        data_start = 1
        for i in range(1, min(5, len(rows))):
            row = rows[i]
            if len(row) <= event_type_col:
                data_start = i + 1
                continue
            event = row[event_type_col].strip()
            if not event:
                data_start = i + 1
                continue
            break

        for row_idx in range(data_start, len(rows)):
            row = rows[row_idx]
            result.total_rows_processed += 1

            if len(row) <= max(timestamp_col, event_type_col, glucose_col):
                result.skipped_rows += 1
                continue

            event_type = row[event_type_col].strip()
            if event_type != "EGV":
                result.skipped_rows += 1
                continue

            # Parse timestamp
            timestamp_str = row[timestamp_col].strip()
            recorded_date = self._parse_timestamp(timestamp_str)
            if recorded_date is None:
                result.skipped_rows += 1
                result.warnings.append(
                    f"Row {row_idx + 1}: Invalid timestamp '{timestamp_str}'"
                )
                continue

            # Parse glucose value
            glucose_str = row[glucose_col].strip()
            glucose = self._parse_glucose(glucose_str)
            if glucose is None:
                result.skipped_rows += 1
                result.warnings.append(
                    f"Row {row_idx + 1}: Invalid glucose value '{glucose_str}'"
                )
                continue

            reading = VitalsReading(
                recorded_date=recorded_date,
                blood_glucose=glucose,
                device_used=self.DEVICE_NAME,
                import_source=self.IMPORT_SOURCE_KEY,
                source_row=row_idx + 1,
            )
            result.readings.append(reading)

        # Compute date range
        if result.readings:
            dates = [r.recorded_date for r in result.readings]
            result.date_range_start = min(dates)
            result.date_range_end = max(dates)

        return result

    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Parse a Dexcom timestamp string into a datetime."""
        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %I:%M:%S %p",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        return None

    def _parse_glucose(self, glucose_str: str) -> Optional[float]:
        """Parse a glucose value, handling Low/High text values."""
        if not glucose_str:
            return None

        low = glucose_str.lower()
        if low == "low":
            return GLUCOSE_LOW_VALUE
        if low == "high":
            return GLUCOSE_HIGH_VALUE

        try:
            value = float(glucose_str)
            if GLUCOSE_MIN <= value <= GLUCOSE_MAX:
                return value
            return None
        except ValueError:
            return None
