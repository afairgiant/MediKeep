import logging
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging_config import get_logger

logger = get_logger(__name__, "sequence_monitor")


@dataclass
class SequenceMonitorConfig:
    """Configuration constants for sequence monitoring"""

    # Health thresholds
    CRITICAL_USAGE_THRESHOLD: float = 0.95  # 95%
    WARNING_USAGE_THRESHOLD: float = 0.80  # 80%
    GOOD_USAGE_THRESHOLD: float = 0.50  # 50%

    # Remaining value thresholds
    CRITICAL_REMAINING_THRESHOLD: int = 100
    WARNING_REMAINING_THRESHOLD: int = 1000

    # Database constants
    DEFAULT_SCHEMA: str = "public"
    DEFAULT_MAX_VALUE: int = 9223372036854775807  # PostgreSQL BIGINT max

    # Health status constants
    HEALTH_CRITICAL: str = "critical"
    HEALTH_WARNING: str = "warning"
    HEALTH_GOOD: str = "good"
    HEALTH_EXCELLENT: str = "excellent"
    HEALTH_UNKNOWN: str = "unknown"

    # Issue types
    ISSUE_NEAR_MAXIMUM: str = "near_maximum"
    ISSUE_BELOW_MINIMUM: str = "below_minimum"
    ISSUE_SYNC_ISSUE: str = "sync_issue"
    ISSUE_UNUSUAL_STATE: str = "unusual_state"


def database_operation(rollback_on_error: bool = True):
    """
    Decorator for database operations with consistent error handling and session management.

    Args:
        rollback_on_error: Whether to rollback on SQLAlchemyError
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                return func(self, *args, **kwargs)
            except SQLAlchemyError as e:
                if rollback_on_error and self.db_session:
                    self.db_session.rollback()
                logger.error(f"Database error in {func.__name__}: {e}")
                return {"error": str(e)}
            except Exception as e:
                logger.error(f"Unexpected error in {func.__name__}: {e}")
                return {"error": f"Unexpected error: {str(e)}"}

        return wrapper

    return decorator


class SequenceQueryBuilder:
    """Builder class for common sequence-related SQL queries"""

    @staticmethod
    def get_sequences_with_metadata() -> str:
        """Query to get all sequences with their metadata"""
        return """
            SELECT DISTINCT
                c.relname as table_name,
                a.attname as column_name,
                s.relname as sequence_name,
                ns.nspname as schema_name,
                CASE 
                    WHEN a.attidentity = 'd' THEN 'identity_default'
                    WHEN a.attidentity = 'a' THEN 'identity_always'
                    WHEN pg_get_serial_sequence(c.relname, a.attname) IS NOT NULL THEN 'serial'
                    ELSE 'unknown'
                END as sequence_type,
                COALESCE(seq.seqstart, 1) as start_value,
                COALESCE(seq.seqincrement, 1) as increment_by,
                COALESCE(seq.seqmax, 9223372036854775807) as max_value,
                COALESCE(seq.seqmin, 1) as min_value
            FROM 
                pg_class c
            JOIN 
                pg_namespace ns ON c.relnamespace = ns.oid
            JOIN 
                pg_attribute a ON c.oid = a.attrelid
            LEFT JOIN 
                pg_depend d ON d.refobjid = c.oid AND d.refobjsubid = a.attnum
            LEFT JOIN 
                pg_class s ON d.objid = s.oid AND s.relkind = 'S'
            LEFT JOIN 
                pg_sequence seq ON s.oid = seq.seqrelid
            WHERE 
                ns.nspname = :schema_name
                AND c.relkind = 'r'
                AND (
                    a.attidentity IN ('d', 'a')
                    OR pg_get_serial_sequence(c.relname, a.attname) IS NOT NULL
                )
                AND NOT a.attisdropped
            ORDER BY 
                c.relname, a.attname
        """

    @staticmethod
    def get_sequence_info() -> str:
        """Query to get detailed sequence information"""
        return """
            SELECT 
                ps.sequencename,
                ps.schemaname,
                ps.sequenceowner,
                ps.data_type,
                ps.start_value,
                ps.min_value,
                ps.max_value,
                ps.increment_by,
                ps.cycle,
                ps.cache_size,
                COALESCE(stat.blks_read, 0) as blocks_read,
                COALESCE(stat.blks_hit, 0) as blocks_hit
            FROM 
                pg_sequences ps
            LEFT JOIN 
                pg_stat_user_sequences stat ON stat.relname = ps.sequencename
            WHERE 
                ps.sequencename = :sequence_name
                AND ps.schemaname = :schema_name
        """

    @staticmethod
    def get_sequence_current_value(sequence_name: str) -> str:
        """Query to get current sequence value"""
        return f"SELECT last_value, is_called FROM {sequence_name}"

    @staticmethod
    def get_table_max_value(table_name: str, column_name: str) -> str:
        """Query to get maximum value in table column"""
        return f"SELECT COALESCE(MAX({column_name}), 0) as max_value FROM {table_name}"


class SequenceValidator:
    """Validator class for sequence-related validations"""

    @staticmethod
    def validate_sequence_bounds(
        value: int, min_val: int, max_val: int, sequence_name: str
    ) -> int:
        """
        Validate and adjust sequence value to be within bounds

        Args:
            value: Proposed sequence value
            min_val: Minimum allowed value
            max_val: Maximum allowed value
            sequence_name: Name of sequence for logging

        Returns:
            Adjusted value within bounds
        """
        if value > max_val:
            logger.warning(
                f"Sequence value {value} exceeds max_value {max_val} "
                f"for sequence {sequence_name}. Using max_value."
            )
            return max_val
        elif value < min_val:
            logger.warning(
                f"Sequence value {value} is below min_value {min_val} "
                f"for sequence {sequence_name}. Using min_value."
            )
            return min_val
        return value


class SequenceHealthAssessor:
    """Class for assessing sequence health status"""

    def __init__(self, config: SequenceMonitorConfig):
        self.config = config

    def assess_health(self, percentage_used: float, remaining_values: int) -> str:
        """
        Assess sequence health based on usage metrics

        Args:
            percentage_used: Percentage of sequence range used
            remaining_values: Number of remaining values

        Returns:
            Health status string
        """
        if not percentage_used or not remaining_values:
            return self.config.HEALTH_UNKNOWN

        if (
            percentage_used >= self.config.CRITICAL_USAGE_THRESHOLD
            or remaining_values < self.config.CRITICAL_REMAINING_THRESHOLD
        ):
            return self.config.HEALTH_CRITICAL
        elif (
            percentage_used >= self.config.WARNING_USAGE_THRESHOLD
            or remaining_values < self.config.WARNING_REMAINING_THRESHOLD
        ):
            return self.config.HEALTH_WARNING
        elif percentage_used >= self.config.GOOD_USAGE_THRESHOLD:
            return self.config.HEALTH_GOOD
        else:
            return self.config.HEALTH_EXCELLENT


class SequenceMonitor:
    """
    Monitor and fix PostgreSQL sequence synchronization issues.

    This class helps identify when auto-increment sequences are out of sync
    with the actual maximum values in tables, which can cause primary key
    conflicts when inserting new records.

    Now follows DRY principles with centralized configuration and reusable components.
    """

    def __init__(self, config: Optional[SequenceMonitorConfig] = None):
        self.db_session: Optional[Session] = None
        self.config = config or SequenceMonitorConfig()
        self.query_builder = SequenceQueryBuilder()
        self.validator = SequenceValidator()
        self.health_assessor = SequenceHealthAssessor(self.config)

    def get_database_session(self) -> Session:
        """Get a database session"""
        if not self.db_session:
            self.db_session = next(get_db())
        return self.db_session

    def close_session(self):
        """Close the database session"""
        if self.db_session:
            self.db_session.close()
            self.db_session = None

    def _execute_query(self, query: str, params: Optional[Dict] = None) -> Any:
        """
        Execute a SQL query with consistent error handling

        Args:
            query: SQL query string
            params: Query parameters

        Returns:
            Query result
        """
        db = self.get_database_session()
        return db.execute(text(query), params or {})

    def _get_sequence_current_state(self, sequence_name: str) -> Dict[str, Any]:
        """
        Get current state of a sequence (last_value, is_called)

        Args:
            sequence_name: Name of the sequence

        Returns:
            Dictionary with current state or default values
        """
        try:
            query = self.query_builder.get_sequence_current_value(sequence_name)
            result = self._execute_query(query).fetchone()

            if result:
                return {"last_value": result.last_value, "is_called": result.is_called}
            else:
                return {"last_value": 0, "is_called": False}

        except SQLAlchemyError:
            logger.debug(f"Could not get current state for sequence {sequence_name}")
            return {"last_value": 0, "is_called": False}

    @database_operation()
    def get_all_tables_with_sequences(self) -> List[Dict[str, str]]:
        """
        Get all tables that have auto-increment sequences using PostgreSQL system catalogs.
        This is more efficient than using information_schema.

        Returns:
            List of dictionaries with table_name, column_name, sequence_name, and additional metadata
        """
        query = self.query_builder.get_sequences_with_metadata()
        result = self._execute_query(query, {"schema_name": self.config.DEFAULT_SCHEMA})

        tables = []
        for row in result:
            tables.append(
                {
                    "table_name": row.table_name,
                    "column_name": row.column_name,
                    "sequence_name": row.sequence_name,
                    "schema_name": row.schema_name,
                    "sequence_type": row.sequence_type,
                    "start_value": row.start_value,
                    "increment_by": row.increment_by,
                    "max_value": row.max_value,
                    "min_value": row.min_value,
                }
            )

        logger.info(f"Found {len(tables)} tables with sequences using system catalogs")
        return tables

    @database_operation()
    def check_sequence_sync(
        self, table_name: str, column_name: str, sequence_name: str
    ) -> Dict[str, Any]:
        """
        Check if a specific sequence is synchronized with its table.

        Args:
            table_name: Name of the table
            column_name: Name of the auto-increment column
            sequence_name: Name of the sequence

        Returns:
            Dictionary with sync status and values
        """
        # Get current sequence state
        seq_state = self._get_sequence_current_state(sequence_name)
        current_sequence_value = (
            seq_state["last_value"] if seq_state["is_called"] else 0
        )

        # Get maximum value in table
        max_query = self.query_builder.get_table_max_value(table_name, column_name)
        max_result = self._execute_query(max_query).fetchone()
        max_table_value = max_result.max_value if max_result else 0

        # Get row count for context
        count_query = f"SELECT COUNT(*) as row_count FROM {table_name}"
        count_result = self._execute_query(count_query).fetchone()
        row_count = count_result.row_count if count_result else 0

        # Check if they're in sync
        is_synced = current_sequence_value >= max_table_value

        return {
            "table_name": table_name,
            "column_name": column_name,
            "sequence_name": sequence_name,
            "current_sequence_value": current_sequence_value,
            "max_table_value": max_table_value,
            "row_count": row_count,
            "is_synced": is_synced,
            "difference": current_sequence_value - max_table_value,
        }

    @database_operation()
    def fix_sequence_sync(
        self, table_name: str, column_name: str, sequence_name: str
    ) -> bool:
        """
        Fix sequence synchronization using PostgreSQL built-in functions.
        Uses more robust PostgreSQL functions for safer sequence management.

        Args:
            table_name: Name of the table
            column_name: Name of the auto-increment column
            sequence_name: Name of the sequence

        Returns:
            True if fixed successfully, False otherwise
        """
        db = self.get_database_session()

        # Get sequence parameters for validation
        seq_info_query = """
            SELECT sequencename, max_value, min_value, increment_by, start_value
            FROM pg_sequences 
            WHERE sequencename = :sequence_name 
            AND schemaname = :schema_name
        """

        seq_info = self._execute_query(
            seq_info_query,
            {"sequence_name": sequence_name, "schema_name": self.config.DEFAULT_SCHEMA},
        ).fetchone()

        if not seq_info:
            logger.error(f"Sequence {sequence_name} not found")
            return False

        # Get maximum value in table
        max_query = self.query_builder.get_table_max_value(table_name, column_name)
        max_result = self._execute_query(max_query).fetchone()
        max_value = max_result.max_value if max_result else 0

        # Calculate and validate new sequence value
        new_sequence_value = max_value + seq_info.increment_by
        new_sequence_value = self.validator.validate_sequence_bounds(
            new_sequence_value, seq_info.min_value, seq_info.max_value, sequence_name
        )

        # Use PostgreSQL's setval function
        setval_query = "SELECT setval(:sequence_name, :new_value, true)"
        result = self._execute_query(
            setval_query,
            {"sequence_name": sequence_name, "new_value": new_sequence_value},
        )

        # Verify the operation
        if result.scalar() == new_sequence_value:
            db.commit()
            logger.info(
                f"✅ Successfully fixed sequence {sequence_name} for table {table_name}: "
                f"set to {new_sequence_value} (table max: {max_value})"
            )
            return True
        else:
            logger.error(f"setval returned unexpected value for {sequence_name}")
            return False

    @database_operation()
    def reset_sequence_to_start(self, sequence_name: str) -> bool:
        """
        Reset a sequence to its start value using PostgreSQL built-in functions.

        Args:
            sequence_name: Name of the sequence to reset

        Returns:
            True if reset successfully, False otherwise
        """
        db = self.get_database_session()

        # Get sequence start value
        seq_query = """
            SELECT start_value 
            FROM pg_sequences 
            WHERE sequencename = :sequence_name 
            AND schemaname = :schema_name
        """

        seq_result = self._execute_query(
            seq_query,
            {"sequence_name": sequence_name, "schema_name": self.config.DEFAULT_SCHEMA},
        ).fetchone()

        if not seq_result:
            logger.error(f"Sequence {sequence_name} not found")
            return False

        # Reset to start value
        reset_query = "SELECT setval(:sequence_name, :start_value, false)"
        self._execute_query(
            reset_query,
            {"sequence_name": sequence_name, "start_value": seq_result.start_value},
        )

        db.commit()
        logger.info(
            f"✅ Reset sequence {sequence_name} to start value {seq_result.start_value}"
        )
        return True

    @database_operation()
    def extend_sequence_max_value(self, sequence_name: str, new_max_value: int) -> bool:
        """
        Extend a sequence's maximum value using PostgreSQL ALTER SEQUENCE command.

        Args:
            sequence_name: Name of the sequence
            new_max_value: New maximum value for the sequence

        Returns:
            True if extended successfully, False otherwise
        """
        db = self.get_database_session()

        # Get current max value for validation
        current_query = """
            SELECT max_value
            FROM pg_sequences 
            WHERE sequencename = :sequence_name 
            AND schemaname = :schema_name
        """

        current_result = self._execute_query(
            current_query,
            {"sequence_name": sequence_name, "schema_name": self.config.DEFAULT_SCHEMA},
        ).fetchone()

        if not current_result:
            logger.error(f"Sequence {sequence_name} not found")
            return False

        if new_max_value <= current_result.max_value:
            logger.warning(
                f"New max value {new_max_value} is not greater than current max {current_result.max_value}"
            )
            return False

        # Use ALTER SEQUENCE to change max value
        alter_query = f"ALTER SEQUENCE {sequence_name} MAXVALUE {new_max_value}"
        self._execute_query(alter_query)
        db.commit()

        logger.info(
            f"✅ Extended sequence {sequence_name} max value from "
            f"{current_result.max_value} to {new_max_value}"
        )
        return True

    def _create_issue_data(
        self, seq_info: Dict, sync_status: Dict, current_val: int, max_val: int
    ) -> Optional[Dict[str, Any]]:
        """
        Create issue data structure for a sequence if issues are detected

        Args:
            seq_info: Sequence information
            sync_status: Sync status from check_sequence_sync
            current_val: Current sequence value
            max_val: Maximum sequence value

        Returns:
            Issue data dictionary or None if no issues
        """
        issue_data = {
            "sequence_name": seq_info["sequence_name"],
            "table_name": seq_info["table_name"],
            "column_name": seq_info["column_name"],
            "current_sequence_value": sync_status.get("current_sequence_value", 0),
            "max_table_value": sync_status.get("max_table_value", 0),
            "max_value": seq_info.get("max_value", self.config.DEFAULT_MAX_VALUE),
            "is_synced": sync_status.get("is_synced", True),
        }

        # Check for various issue types
        if current_val >= (max_val * self.config.CRITICAL_USAGE_THRESHOLD):
            issue_data.update(
                {
                    "issue_type": self.config.ISSUE_NEAR_MAXIMUM,
                    "recommendation": f"Sequence is approaching maximum value ({current_val}/{max_val}). Consider increasing max_value.",
                    "severity": self.config.HEALTH_CRITICAL,
                }
            )
            return issue_data
        elif current_val < 0:
            issue_data.update(
                {
                    "issue_type": self.config.ISSUE_BELOW_MINIMUM,
                    "recommendation": "Sequence value is negative. This may cause constraint violations.",
                    "severity": self.config.HEALTH_CRITICAL,
                }
            )
            return issue_data
        elif not issue_data["is_synced"]:
            issue_data.update(
                {
                    "issue_type": self.config.ISSUE_SYNC_ISSUE,
                    "recommendation": "Sequence is behind table maximum value. This may cause primary key conflicts.",
                    "severity": self.config.HEALTH_WARNING,
                }
            )
            return issue_data

        return None

    def monitor_all_sequences(self, auto_fix: bool = False) -> Dict[str, Any]:
        """
        Monitor all sequences in the database.

        Args:
            auto_fix: If True, automatically fix out-of-sync sequences

        Returns:
            Dictionary with monitoring results
        """
        try:
            tables = self.get_all_tables_with_sequences()

            if not tables:
                logger.warning("No tables with sequences found")
                return {
                    "total_tables": 0,
                    "synced_tables": 0,
                    "out_of_sync_tables": [],
                    "fixed_tables": [],
                    "error_tables": [],
                }

            synced_tables = []
            out_of_sync_tables = []
            fixed_tables = []
            error_tables = []

            logger.info(f"Monitoring {len(tables)} sequences...")

            for table_info in tables:
                table_name = table_info["table_name"]
                column_name = table_info["column_name"]
                sequence_name = table_info["sequence_name"]

                if not sequence_name:
                    continue

                # Check sequence synchronization
                sync_info = self.check_sequence_sync(
                    table_name, column_name, sequence_name
                )

                if "error" in sync_info:
                    error_tables.append(sync_info)
                    logger.error(
                        f"❌ Error checking {table_name}: {sync_info['error']}"
                    )
                    continue

                if sync_info["is_synced"]:
                    synced_tables.append(sync_info)
                    logger.debug(f"✅ {table_name}.{column_name} is synchronized")
                else:
                    out_of_sync_tables.append(sync_info)
                    logger.warning(
                        f"⚠️  {table_name}.{column_name} is out of sync: "
                        f"sequence={sync_info['current_sequence_value']}, "
                        f"max_value={sync_info['max_table_value']}"
                    )

                    # Auto-fix if requested
                    if auto_fix:
                        if self.fix_sequence_sync(
                            table_name, column_name, sequence_name
                        ):
                            fixed_tables.append(sync_info)
                        else:
                            error_tables.append(sync_info)

            # Log summary
            total_tables = len(tables)
            synced_count = len(synced_tables)
            out_of_sync_count = len(out_of_sync_tables)
            fixed_count = len(fixed_tables)
            error_count = len(error_tables)

            logger.info("📊 Sequence Monitor Summary:")
            logger.info(f"   Total tables: {total_tables}")
            logger.info(f"   Synced: {synced_count}")
            logger.info(f"   Out of sync: {out_of_sync_count}")
            if auto_fix:
                logger.info(f"   Fixed: {fixed_count}")
            logger.info(f"   Errors: {error_count}")

            return {
                "total_tables": total_tables,
                "synced_tables": synced_tables,
                "out_of_sync_tables": out_of_sync_tables,
                "fixed_tables": fixed_tables,
                "error_tables": error_tables,
                "summary": {
                    "synced_count": synced_count,
                    "out_of_sync_count": out_of_sync_count,
                    "fixed_count": fixed_count,
                    "error_count": error_count,
                },
            }

        except Exception as e:
            logger.error(f"❌ Error monitoring sequences: {e}")
            return {
                "error": str(e),
                "total_tables": 0,
                "synced_tables": [],
                "out_of_sync_tables": [],
                "fixed_tables": [],
                "error_tables": [],
            }
        finally:
            self.close_session()

    def get_sequence_info(self, sequence_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific sequence using PostgreSQL built-in views.

        Args:
            sequence_name: Name of the sequence

        Returns:
            Dictionary with comprehensive sequence information
        """
        db = self.get_database_session()

        try:
            # Use pg_sequences view (available in PostgreSQL 10+) combined with statistics
            query = text(
                """
                SELECT 
                    ps.sequencename,
                    ps.schemaname,
                    ps.sequenceowner,
                    ps.data_type,
                    ps.start_value,
                    ps.min_value,
                    ps.max_value,
                    ps.increment_by,
                    ps.cycle,
                    ps.cache_size,
                    -- Current sequence state
                    seq_state.last_value,
                    seq_state.log_cnt,
                    seq_state.is_called,
                    -- Usage statistics from pg_stat_user_sequences
                    COALESCE(stat.blks_read, 0) as blocks_read,
                    COALESCE(stat.blks_hit, 0) as blocks_hit,
                    -- Calculate effective current value
                    CASE 
                        WHEN seq_state.is_called THEN seq_state.last_value
                        ELSE seq_state.last_value - ps.increment_by
                    END as effective_current_value
                FROM 
                    pg_sequences ps
                LEFT JOIN 
                    pg_sequence seq_table ON seq_table.seqrelid = (
                        SELECT oid FROM pg_class WHERE relname = ps.sequencename
                    )
                LEFT JOIN 
                    LATERAL (
                        SELECT last_value, log_cnt, is_called 
                        FROM pg_sequence_parameters(
                            (SELECT oid FROM pg_class WHERE relname = ps.sequencename)::regclass
                        ) seq_info,
                        LATERAL (
                            SELECT last_value, is_called, log_cnt 
                            FROM ONLY pg_class pc 
                            WHERE pc.oid = (SELECT oid FROM pg_class WHERE relname = ps.sequencename)
                            LIMIT 1
                        ) seq_vals
                    ) seq_state ON true
                LEFT JOIN 
                    pg_stat_user_sequences stat ON stat.relname = ps.sequencename
                WHERE 
                    ps.sequencename = :sequence_name
                    AND ps.schemaname = :schema_name
            """
            )

            result = db.execute(
                query,
                {
                    "sequence_name": sequence_name,
                    "schema_name": self.config.DEFAULT_SCHEMA,
                },
            ).fetchone()

            if result:
                return {
                    "sequence_name": result.sequencename,
                    "schema_name": result.schemaname,
                    "owner": result.sequenceowner,
                    "data_type": result.data_type,
                    "start_value": result.start_value,
                    "minimum_value": result.min_value,
                    "maximum_value": result.max_value,
                    "increment_by": result.increment_by,
                    "cycle": result.cycle,
                    "cache_size": result.cache_size,
                    "last_value": result.last_value,
                    "is_called": result.is_called,
                    "effective_current_value": result.effective_current_value,
                    "log_count": result.log_cnt,
                    # Performance statistics
                    "blocks_read": result.blocks_read,
                    "blocks_hit": result.blocks_hit,
                    "cache_hit_ratio": (
                        result.blocks_hit
                        / max(result.blocks_read + result.blocks_hit, 1)
                        * 100
                        if (result.blocks_read or result.blocks_hit)
                        else 0
                    ),
                }
            else:
                # Fallback to simpler query if pg_sequences view fails
                simple_query = text(
                    f"""
                    SELECT 
                        last_value, 
                        is_called,
                        log_cnt
                    FROM {sequence_name}
                """
                )
                simple_result = db.execute(simple_query).fetchone()

                if simple_result:
                    return {
                        "sequence_name": sequence_name,
                        "last_value": simple_result.last_value,
                        "is_called": simple_result.is_called,
                        "log_count": simple_result.log_cnt,
                        "effective_current_value": (
                            simple_result.last_value
                            if simple_result.is_called
                            else simple_result.last_value - 1
                        ),
                        "note": "Limited info - using fallback query",
                    }
                else:
                    return {"error": f"Sequence {sequence_name} not found"}

        except SQLAlchemyError as e:
            logger.error(f"Error getting sequence info for {sequence_name}: {e}")
            return {"error": str(e)}

    def get_all_sequence_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive statistics for all sequences using PostgreSQL built-in views.

        Returns:
            Dictionary with sequence usage statistics and health metrics
        """
        db = self.get_database_session()

        try:
            query = text(
                """
                SELECT 
                    ps.sequencename,
                    ps.schemaname,
                    ps.start_value,
                    ps.min_value,
                    ps.max_value,
                    ps.increment_by,
                    ps.cache_size,
                    -- Current state (will be populated per sequence)
                    0 as effective_current_value,
                    0 as last_value,
                    false as is_called,
                    -- Usage statistics
                    COALESCE(stat.blks_read, 0) as blocks_read,
                    COALESCE(stat.blks_hit, 0) as blocks_hit,
                    -- Health metrics (will be calculated per sequence)
                    0.0 as percentage_used,
                    ps.max_value as remaining_values,
                    -- Performance metrics
                    CASE 
                        WHEN (stat.blks_read + stat.blks_hit) > 0 
                        THEN ROUND((stat.blks_hit::numeric / (stat.blks_read + stat.blks_hit)::numeric) * 100, 2)
                        ELSE 0 
                    END as cache_hit_ratio
                FROM 
                    pg_sequences ps
                LEFT JOIN 
                    pg_stat_user_sequences stat ON stat.relname = ps.sequencename
                WHERE 
                    ps.schemaname = :schema_name
                ORDER BY 
                    percentage_used DESC NULLS LAST, ps.sequencename
            """
            )

            result = db.execute(query, {"schema_name": self.config.DEFAULT_SCHEMA})
            sequences = []

            for row in result:
                # Get current sequence values individually for each sequence
                try:
                    seq_query = text(
                        f"SELECT last_value, is_called FROM {row.sequencename}"
                    )
                    seq_result = db.execute(seq_query).fetchone()

                    if seq_result:
                        last_value = seq_result.last_value
                        is_called = seq_result.is_called
                        effective_current_value = (
                            last_value if is_called else last_value - row.increment_by
                        )
                        percentage_used = (
                            round((last_value / row.max_value) * 100, 2)
                            if row.max_value > 0
                            else 0
                        )
                        remaining_values = row.max_value - last_value
                    else:
                        last_value = 0
                        is_called = False
                        effective_current_value = 0
                        percentage_used = 0
                        remaining_values = row.max_value

                except SQLAlchemyError:
                    # Fallback values if sequence query fails
                    last_value = 0
                    is_called = False
                    effective_current_value = 0
                    percentage_used = 0
                    remaining_values = row.max_value

                sequences.append(
                    {
                        "sequence_name": row.sequencename,
                        "schema_name": row.schemaname,
                        "start_value": row.start_value,
                        "min_value": row.min_value,
                        "max_value": row.max_value,
                        "increment_by": row.increment_by,
                        "cache_size": row.cache_size,
                        "effective_current_value": effective_current_value,
                        "last_value": last_value,
                        "is_called": is_called,
                        "blocks_read": row.blocks_read,
                        "blocks_hit": row.blocks_hit,
                        "percentage_used": percentage_used,
                        "remaining_values": remaining_values,
                        "cache_hit_ratio": row.cache_hit_ratio,
                        "health_status": self.health_assessor.assess_health(
                            percentage_used, remaining_values
                        ),
                    }
                )

            return {
                "sequences": sequences,
                "total_sequences": len(sequences),
                "high_usage_sequences": [
                    seq
                    for seq in sequences
                    if seq["percentage_used"]
                    and seq["percentage_used"]
                    > (self.config.WARNING_USAGE_THRESHOLD * 100)
                ],
                "near_limit_sequences": [
                    seq
                    for seq in sequences
                    if seq["remaining_values"]
                    and seq["remaining_values"]
                    < self.config.WARNING_REMAINING_THRESHOLD
                ],
            }

        except SQLAlchemyError as e:
            logger.error(f"Error getting sequence statistics: {e}")
            return {"error": str(e)}

    def detect_sequence_issues(self) -> Dict[str, Any]:
        """
        Use PostgreSQL built-in functions to detect potential sequence issues.

        Returns:
            Dictionary with detected issues and recommendations
        """
        db = self.get_database_session()

        try:
            # Use a simplified approach that leverages existing methods
            # First get all sequences and their basic info
            sequences = self.get_all_tables_with_sequences()
            issues = []

            for seq_info in sequences:
                table_name = seq_info["table_name"]
                column_name = seq_info["column_name"]
                sequence_name = seq_info["sequence_name"]

                if not sequence_name:
                    continue

                # Check sync status using existing method
                sync_status = self.check_sequence_sync(
                    table_name, column_name, sequence_name
                )

                if "error" in sync_status:
                    continue

                current_val = sync_status.get("current_sequence_value", 0)
                max_val = seq_info.get("max_value", self.config.DEFAULT_MAX_VALUE)
                issue_data = self._create_issue_data(
                    seq_info, sync_status, current_val, max_val
                )

                if issue_data:
                    issues.append(issue_data)

            return {
                "issues_found": len(issues),
                "critical_issues": [
                    i for i in issues if i["severity"] == self.config.HEALTH_CRITICAL
                ],
                "warning_issues": [
                    i for i in issues if i["severity"] == self.config.HEALTH_WARNING
                ],
                "all_issues": issues,
            }

        except SQLAlchemyError as e:
            logger.error(f"Error detecting sequence issues: {e}")
            return {"error": str(e)}

    def _get_issue_severity(self, issue_type: str) -> str:
        """Get severity level for sequence issues"""
        severity_map = {
            "near_maximum": self.config.HEALTH_CRITICAL,
            "below_minimum": self.config.HEALTH_CRITICAL,
            "unusual_state": self.config.HEALTH_WARNING,
            None: self.config.HEALTH_WARNING,  # For sync issues
        }
        return severity_map.get(issue_type, self.config.HEALTH_WARNING)


def monitor_sequences_cli():
    """Enhanced CLI function to monitor sequences using PostgreSQL built-in tools"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Monitor PostgreSQL sequences using built-in tools",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
    Examples:
    python sequence_monitor.py --stats                    # Show comprehensive statistics
    python sequence_monitor.py --fix                      # Fix all out-of-sync sequences
    python sequence_monitor.py --table users              # Monitor specific table
    python sequence_monitor.py --detect-issues            # Detect potential issues
    python sequence_monitor.py --reset-sequence users_id_seq  # Reset sequence to start
    python sequence_monitor.py --extend-sequence users_id_seq --new-max 1000000  # Extend max value
        """,
    )

    # Monitoring options
    parser.add_argument(
        "--fix", action="store_true", help="Automatically fix out-of-sync sequences"
    )
    parser.add_argument("--table", type=str, help="Monitor specific table only")
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show comprehensive sequence statistics using PostgreSQL built-in views",
    )
    parser.add_argument(
        "--detect-issues",
        action="store_true",
        help="Detect potential sequence issues (near maximum, out of sync, etc.)",
    )

    # Advanced sequence management
    parser.add_argument(
        "--reset-sequence",
        type=str,
        help="Reset a specific sequence to its start value",
    )
    parser.add_argument(
        "--extend-sequence",
        type=str,
        help="Extend the maximum value of a specific sequence",
    )
    parser.add_argument(
        "--new-max",
        type=int,
        help="New maximum value when extending a sequence (use with --extend-sequence)",
    )
    parser.add_argument(
        "--sequence-info",
        type=str,
        help="Get detailed information about a specific sequence",
    )

    args = parser.parse_args()

    monitor = SequenceMonitor()

    try:
        # Show comprehensive statistics
        if args.stats:
            print("🔍 Getting comprehensive sequence statistics...")
            stats = monitor.get_all_sequence_statistics()

            if "error" in stats:
                print(f"❌ Error: {stats['error']}")
                return

            print(f"\n📊 Sequence Statistics Summary:")
            print(f"   Total sequences: {stats['total_sequences']}")
            print(
                f"   High usage (>{monitor.config.WARNING_USAGE_THRESHOLD*100:.0f}%): {len(stats['high_usage_sequences'])}"
            )
            print(
                f"   Near limit (<{monitor.config.WARNING_REMAINING_THRESHOLD} remaining): {len(stats['near_limit_sequences'])}"
            )

            if stats["sequences"]:
                print(f"\n📋 Detailed Sequence Information:")
                for seq in stats["sequences"]:
                    health_emoji = {
                        "excellent": "🟢",
                        "good": "🟡",
                        "warning": "🟠",
                        "critical": "🔴",
                        "unknown": "⚪",
                    }.get(seq["health_status"], "⚪")

                    print(
                        f"   {health_emoji} {seq['sequence_name']}: {seq['percentage_used']:.1f}% used, "
                        f"{seq['remaining_values']:,} remaining, cache hit: {seq['cache_hit_ratio']:.1f}%"
                    )
            return

        # Detect potential issues
        if args.detect_issues:
            print("🔍 Detecting potential sequence issues...")
            issues = monitor.detect_sequence_issues()

            if "error" in issues:
                print(f"❌ Error: {issues['error']}")
                return

            print(f"\n🚨 Issue Detection Results:")
            print(f"   Total issues found: {issues['issues_found']}")
            print(f"   Critical issues: {len(issues['critical_issues'])}")
            print(f"   Warning issues: {len(issues['warning_issues'])}")

            if issues["critical_issues"]:
                print(f"\n🔴 Critical Issues:")
                for issue in issues["critical_issues"]:
                    print(f"   • {issue['sequence_name']}: {issue['recommendation']}")

            if issues["warning_issues"]:
                print(f"\n🟡 Warning Issues:")
                for issue in issues["warning_issues"]:
                    print(f"   • {issue['sequence_name']}: {issue['recommendation']}")
            return

        # Reset sequence
        if args.reset_sequence:
            print(f"🔄 Resetting sequence {args.reset_sequence} to start value...")
            success = monitor.reset_sequence_to_start(args.reset_sequence)
            if success:
                print(f"✅ Successfully reset sequence {args.reset_sequence}")
            else:
                print(f"❌ Failed to reset sequence {args.reset_sequence}")
            return

        # Extend sequence maximum value
        if args.extend_sequence:
            if not args.new_max:
                print("❌ Error: --new-max is required when using --extend-sequence")
                return

            print(
                f"📈 Extending sequence {args.extend_sequence} to max value {args.new_max}..."
            )
            success = monitor.extend_sequence_max_value(
                args.extend_sequence, args.new_max
            )
            if success:
                print(f"✅ Successfully extended sequence {args.extend_sequence}")
            else:
                print(f"❌ Failed to extend sequence {args.extend_sequence}")
            return

        # Get detailed sequence information
        if args.sequence_info:
            print(
                f"📋 Getting detailed information for sequence {args.sequence_info}..."
            )
            info = monitor.get_sequence_info(args.sequence_info)

            if "error" in info:
                print(f"❌ Error: {info['error']}")
                return

            print(f"\n📋 Sequence Information:")
            for key, value in info.items():
                if key not in ["error"]:
                    print(f"   {key.replace('_', ' ').title()}: {value}")
            return

        # Monitor specific table
        if args.table:
            print(f"🔍 Monitoring sequences for table: {args.table}")
            tables = monitor.get_all_tables_with_sequences()
            table_info = next(
                (t for t in tables if t["table_name"] == args.table), None
            )

            if not table_info:
                print(f"❌ Table {args.table} not found or has no sequences")
                return

            sync_info = monitor.check_sequence_sync(
                table_info["table_name"],
                table_info["column_name"],
                table_info["sequence_name"],
            )

            print(f"\n📊 Table: {sync_info['table_name']}")
            print(f"   Sequence: {sync_info['sequence_name']}")
            print(f"   Current sequence value: {sync_info['current_sequence_value']}")
            print(f"   Max table value: {sync_info['max_table_value']}")
            print(f"   Row count: {sync_info.get('row_count', 'unknown')}")
            print(f"   Is synced: {'✅' if sync_info['is_synced'] else '❌'}")

            if not sync_info["is_synced"] and args.fix:
                print(f"\n🔧 Fixing sequence synchronization...")
                success = monitor.fix_sequence_sync(
                    table_info["table_name"],
                    table_info["column_name"],
                    table_info["sequence_name"],
                )
                print(f"   Fix applied: {'✅' if success else '❌'}")
            return

        # Default: Monitor all sequences
        print("🔍 Monitoring all sequences using PostgreSQL built-in tools...")
        results = monitor.monitor_all_sequences(auto_fix=args.fix)

        print(f"\n📊 Sequence Monitor Summary:")
        print(
            f"   Total tables: {results['summary']['synced_count'] + results['summary']['out_of_sync_count']}"
        )
        print(f"   Synced: {results['summary']['synced_count']} ✅")
        print(f"   Out of sync: {results['summary']['out_of_sync_count']} ⚠️")

        if args.fix:
            print(f"   Fixed: {results['summary']['fixed_count']} 🔧")

        if results["summary"]["error_count"] > 0:
            print(f"   Errors: {results['summary']['error_count']} ❌")

        if results["out_of_sync_tables"]:
            print(f"\n⚠️  Out of sync sequences:")
            for table in results["out_of_sync_tables"]:
                print(
                    f"   • {table['table_name']}: seq={table['current_sequence_value']}, "
                    f"max={table['max_table_value']}, diff={table.get('difference', 'unknown')}"
                )

        # Suggest using advanced features
        if not args.stats and not args.detect_issues:
            print(f"\n💡 Pro Tips:")
            print(f"   • Use --stats for comprehensive sequence statistics")
            print(f"   • Use --detect-issues to find potential problems")
            print(f"   • Use --sequence-info <name> for detailed sequence information")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        monitor.close_session()


if __name__ == "__main__":
    monitor_sequences_cli()
