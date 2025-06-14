import logging
from typing import Dict, List, Any, Optional
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.core.logging_config import get_logger

logger = get_logger(__name__, "sequence_monitor")


class SequenceMonitor:
    """
    Monitor and fix PostgreSQL sequence synchronization issues.

    This class helps identify when auto-increment sequences are out of sync
    with the actual maximum values in tables, which can cause primary key
    conflicts when inserting new records.
    """

    def __init__(self):
        self.db_session: Optional[Session] = None

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

    def get_all_tables_with_sequences(self) -> List[Dict[str, str]]:
        """
        Get all tables that have auto-increment sequences.

        Returns:
            List of dictionaries with table_name, column_name, and sequence_name
        """
        db = self.get_database_session()

        query = text("""
            SELECT 
                t.table_name,
                c.column_name,
                pg_get_serial_sequence(t.table_name, c.column_name) as sequence_name
            FROM 
                information_schema.tables t
            JOIN 
                information_schema.columns c ON t.table_name = c.table_name
            WHERE 
                t.table_schema = 'public'
                AND c.column_default LIKE 'nextval%'
                AND pg_get_serial_sequence(t.table_name, c.column_name) IS NOT NULL
            ORDER BY 
                t.table_name, c.column_name
        """)

        try:
            result = db.execute(query)
            tables = []

            for row in result:
                tables.append(
                    {
                        "table_name": row.table_name,
                        "column_name": row.column_name,
                        "sequence_name": row.sequence_name.split(".")[-1]
                        if row.sequence_name
                        else None,
                    }
                )

            logger.info(f"Found {len(tables)} tables with sequences")
            return tables

        except SQLAlchemyError as e:
            logger.error(f"Error getting tables with sequences: {e}")
            return []

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
        db = self.get_database_session()

        try:
            # Get current sequence value - use a fresh transaction for each query
            current_sequence_value = None
            try:
                # Try to get current value first
                seq_query = text(f"SELECT currval('{sequence_name}') as current_value")
                seq_result = db.execute(seq_query).fetchone()
                current_sequence_value = seq_result.current_value if seq_result else 0
            except SQLAlchemyError:
                # If currval fails (sequence not used in this session), get last_value
                try:
                    db.rollback()  # Clear the failed transaction
                    seq_query = text(f"SELECT last_value FROM {sequence_name}")
                    seq_result = db.execute(seq_query).fetchone()
                    current_sequence_value = seq_result.last_value if seq_result else 1
                except SQLAlchemyError:
                    # If that also fails, try to get sequence info
                    try:
                        db.rollback()  # Clear the failed transaction
                        seq_query = text(
                            f"SELECT last_value, is_called FROM {sequence_name}"
                        )
                        seq_result = db.execute(seq_query).fetchone()
                        if seq_result:
                            # If is_called is False, the sequence hasn't been used yet
                            current_sequence_value = (
                                seq_result.last_value if seq_result.is_called else 0
                            )
                        else:
                            current_sequence_value = 1
                    except SQLAlchemyError:
                        db.rollback()  # Clear any failed transaction
                        current_sequence_value = 1

            # Get maximum value in table
            max_query = text(
                f"SELECT COALESCE(MAX({column_name}), 0) as max_value FROM {table_name}"
            )
            max_result = db.execute(max_query).fetchone()
            max_table_value = max_result.max_value if max_result else 0

            # Check if they're in sync
            # Sequence should be >= max table value
            is_synced = current_sequence_value >= max_table_value

            # Get row count for context
            count_query = text(f"SELECT COUNT(*) as row_count FROM {table_name}")
            count_result = db.execute(count_query).fetchone()
            row_count = count_result.row_count if count_result else 0

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

        except SQLAlchemyError as e:
            # Make sure to rollback any failed transaction
            db.rollback()
            logger.error(
                f"Error checking sequence sync for {table_name}.{column_name}: {e}"
            )
            return {
                "table_name": table_name,
                "column_name": column_name,
                "sequence_name": sequence_name,
                "error": str(e),
                "is_synced": False,
            }

    def fix_sequence_sync(
        self, table_name: str, column_name: str, sequence_name: str
    ) -> bool:
        """
        Fix sequence synchronization by setting it to max table value + 1.

        Args:
            table_name: Name of the table
            column_name: Name of the auto-increment column
            sequence_name: Name of the sequence

        Returns:
            True if fixed successfully, False otherwise
        """
        db = self.get_database_session()

        try:
            # Get the maximum value in the table
            max_query = text(
                f"SELECT COALESCE(MAX({column_name}), 0) as max_value FROM {table_name}"
            )
            max_result = db.execute(max_query).fetchone()
            max_value = max_result.max_value if max_result else 0

            # Set sequence to max_value + 1
            new_sequence_value = max_value + 1

            # Use setval to set the sequence value
            setval_query = text(
                f"SELECT setval('{sequence_name}', {new_sequence_value}, false)"
            )
            db.execute(setval_query)
            db.commit()

            logger.info(
                f"✅ Fixed sequence {sequence_name} for table {table_name}: set to {new_sequence_value}"
            )
            return True

        except SQLAlchemyError as e:
            logger.error(f"❌ Error fixing sequence {sequence_name}: {e}")
            db.rollback()
            return False

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

            logger.info(f"📊 Sequence Monitor Summary:")
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
        Get detailed information about a specific sequence.

        Args:
            sequence_name: Name of the sequence

        Returns:
            Dictionary with sequence information
        """
        db = self.get_database_session()

        try:
            query = text(f"""
                SELECT 
                    sequence_name,
                    data_type,
                    start_value,
                    minimum_value,
                    maximum_value,
                    increment,
                    cycle_option
                FROM information_schema.sequences 
                WHERE sequence_name = '{sequence_name}'
            """)

            result = db.execute(query).fetchone()

            if result:
                # Get current value
                current_query = text(
                    f"SELECT last_value, is_called FROM {sequence_name}"
                )
                current_result = db.execute(current_query).fetchone()

                return {
                    "sequence_name": result.sequence_name,
                    "data_type": result.data_type,
                    "start_value": result.start_value,
                    "minimum_value": result.minimum_value,
                    "maximum_value": result.maximum_value,
                    "increment": result.increment,
                    "cycle_option": result.cycle_option,
                    "current_value": current_result.last_value
                    if current_result
                    else None,
                    "is_called": current_result.is_called if current_result else None,
                }
            else:
                return {"error": f"Sequence {sequence_name} not found"}

        except SQLAlchemyError as e:
            logger.error(f"Error getting sequence info for {sequence_name}: {e}")
            return {"error": str(e)}


def monitor_sequences_cli():
    """CLI function to monitor sequences"""
    import argparse

    parser = argparse.ArgumentParser(description="Monitor PostgreSQL sequences")
    parser.add_argument(
        "--fix", action="store_true", help="Automatically fix out-of-sync sequences"
    )
    parser.add_argument("--table", type=str, help="Monitor specific table only")

    args = parser.parse_args()

    monitor = SequenceMonitor()

    try:
        if args.table:
            # Monitor specific table
            tables = monitor.get_all_tables_with_sequences()
            table_info = next(
                (t for t in tables if t["table_name"] == args.table), None
            )

            if not table_info:
                print(f"Table {args.table} not found or has no sequences")
                return

            sync_info = monitor.check_sequence_sync(
                table_info["table_name"],
                table_info["column_name"],
                table_info["sequence_name"],
            )

            print(f"Table: {sync_info['table_name']}")
            print(f"Sequence: {sync_info['sequence_name']}")
            print(f"Current sequence value: {sync_info['current_sequence_value']}")
            print(f"Max table value: {sync_info['max_table_value']}")
            print(f"Is synced: {sync_info['is_synced']}")

            if not sync_info["is_synced"] and args.fix:
                success = monitor.fix_sequence_sync(
                    table_info["table_name"],
                    table_info["column_name"],
                    table_info["sequence_name"],
                )
                print(f"Fix applied: {success}")
        else:
            # Monitor all sequences
            results = monitor.monitor_all_sequences(auto_fix=args.fix)

            print(
                f"Total tables: {results['summary']['synced_count'] + results['summary']['out_of_sync_count']}"
            )
            print(f"Synced: {results['summary']['synced_count']}")
            print(f"Out of sync: {results['summary']['out_of_sync_count']}")

            if args.fix:
                print(f"Fixed: {results['summary']['fixed_count']}")

            if results["out_of_sync_tables"]:
                print("\nOut of sync tables:")
                for table in results["out_of_sync_tables"]:
                    print(
                        f"  {table['table_name']}: seq={table['current_sequence_value']}, max={table['max_table_value']}"
                    )

    except Exception as e:
        print(f"Error: {e}")
    finally:
        monitor.close_session()


if __name__ == "__main__":
    monitor_sequences_cli()
