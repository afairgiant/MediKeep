"""
PostgreSQL Sequence Maintenance Migration
========================================

This Alembic migration ensures all sequences are properly synchronized
and adds database-level triggers to maintain sequence integrity.

To apply this migration:
    alembic revision --autogenerate -m "add_sequence_maintenance"
    alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "sequence_maintenance_001"
down_revision = "c4d543c69761"  # Your latest revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add sequence maintenance and triggers"""

    # Get database connection
    connection = op.get_bind()

    # List of tables with auto-incrementing primary keys
    tables_with_sequences = [
        "users",
        "patients",
        "practitioners",
        "medications",
        "lab_results",
        "lab_result_files",
        "conditions",
        "allergies",
        "immunizations",
        "procedures",
        "treatments",
        "encounters",
    ]

    # 1. Fix all existing sequences
    print("Fixing existing sequences...")
    for table_name in tables_with_sequences:
        fix_sequence_sql = f"""
        DO $$
        DECLARE
            max_id INTEGER;
            seq_name TEXT := '{table_name}_id_seq';
        BEGIN
            -- Get the maximum ID from the table
            EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', '{table_name}') INTO max_id;
            
            -- Set the sequence to start from max_id + 1
            PERFORM setval(seq_name, max_id + 1, false);
            
            RAISE NOTICE 'Fixed sequence % to start from %', seq_name, max_id + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not fix sequence for table {table_name}: %', SQLERRM;
        END $$;
        """
        connection.execute(text(fix_sequence_sql))

    # 2. Create a function to maintain sequence integrity
    sequence_maintenance_function = """
    CREATE OR REPLACE FUNCTION maintain_sequence_integrity()
    RETURNS TRIGGER AS $$
    DECLARE
        max_id INTEGER;
        seq_name TEXT;
        table_name TEXT;
    BEGIN
        -- Get the table name from the trigger context
        table_name := TG_TABLE_NAME;
        seq_name := table_name || '_id_seq';
        
        -- Only proceed if this is an INSERT operation
        IF TG_OP = 'INSERT' THEN
            -- Check if an explicit ID was provided
            IF NEW.id IS NOT NULL THEN
                -- Get current sequence value
                EXECUTE format('SELECT last_value FROM %I', seq_name) INTO max_id;
                
                -- If the inserted ID is >= sequence value, update the sequence
                IF NEW.id >= max_id THEN
                    PERFORM setval(seq_name, NEW.id + 1, false);
                END IF;
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """
    connection.execute(text(sequence_maintenance_function))

    # 3. Create triggers for each table
    for table_name in tables_with_sequences:
        trigger_sql = f"""
        DROP TRIGGER IF EXISTS maintain_sequence_{table_name} ON {table_name};
        CREATE TRIGGER maintain_sequence_{table_name}
            AFTER INSERT ON {table_name}
            FOR EACH ROW
            EXECUTE FUNCTION maintain_sequence_integrity();
        """
        connection.execute(text(trigger_sql))

    # 4. Create a monitoring view
    monitoring_view_sql = """
    CREATE OR REPLACE VIEW sequence_status AS
    SELECT 
        schemaname,
        tablename,
        attname as column_name,
        (schemaname||'.'||tablename||'_'||attname||'_seq') as sequence_name,
        (
            SELECT last_value 
            FROM pg_sequences 
            WHERE schemaname = t.schemaname 
            AND sequencename = (tablename||'_'||attname||'_seq')
        ) as current_sequence_value,
        (
            SELECT COALESCE(max((t2.*)::text::integer), 0)
            FROM (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') t2
            JOIN pg_attribute a ON a.attrelid = (quote_ident(t2.schemaname)||'.'||quote_ident(t2.tablename))::regclass
            WHERE a.attname = 'id' 
            AND t2.tablename = t.tablename
        ) as max_table_value,
        CASE 
            WHEN (
                SELECT last_value 
                FROM pg_sequences 
                WHERE schemaname = t.schemaname 
                AND sequencename = (tablename||'_'||attname||'_seq')
            ) <= (
                SELECT COALESCE(max((t2.*)::text::integer), 0)
                FROM (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') t2
                JOIN pg_attribute a ON a.attrelid = (quote_ident(t2.schemaname)||'.'||quote_ident(t2.tablename))::regclass
                WHERE a.attname = 'id' 
                AND t2.tablename = t.tablename
            )
            THEN 'OUT_OF_SYNC'
            ELSE 'SYNCHRONIZED'
        END as status
    FROM 
        pg_tables t
        JOIN pg_attribute a ON a.attrelid = (quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass
    WHERE 
        t.schemaname = 'public'
        AND a.attname = 'id'
        AND a.atttypid = 'integer'::regtype
        AND EXISTS (
            SELECT 1 FROM pg_sequences s 
            WHERE s.schemaname = t.schemaname 
            AND s.sequencename = (t.tablename||'_'||a.attname||'_seq')
        );
    """
    connection.execute(text(monitoring_view_sql))

    # 5. Create a function to fix all sequences at once
    fix_all_sequences_function = """
    CREATE OR REPLACE FUNCTION fix_all_sequences()
    RETURNS TABLE(
        table_name TEXT,
        sequence_name TEXT,
        old_value BIGINT,
        new_value BIGINT,
        status TEXT
    ) AS $$
    DECLARE
        rec RECORD;
        max_val BIGINT;
        seq_val BIGINT;
        new_val BIGINT;
    BEGIN
        FOR rec IN 
            SELECT tablename, (tablename||'_id_seq') as seq_name
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND EXISTS (
                SELECT 1 FROM pg_sequences s 
                WHERE s.schemaname = 'public' 
                AND s.sequencename = (pg_tables.tablename||'_id_seq')
            )
        LOOP
            -- Get max ID from table
            EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', rec.tablename) INTO max_val;
            
            -- Get current sequence value
            EXECUTE format('SELECT last_value FROM %I', rec.seq_name) INTO seq_val;
            
            -- Calculate new sequence value
            new_val := max_val + 1;
            
            -- Return values
            table_name := rec.tablename;
            sequence_name := rec.seq_name;
            old_value := seq_val;
            new_value := new_val;
            
            -- Fix sequence if needed
            IF seq_val <= max_val THEN
                EXECUTE format('SELECT setval(%L, %s, false)', rec.seq_name, new_val);
                status := 'FIXED';
            ELSE
                status := 'OK';
            END IF;
            
            RETURN NEXT;
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;
    """
    connection.execute(text(fix_all_sequences_function))

    print("Sequence maintenance migration completed successfully!")


def downgrade() -> None:
    """Remove sequence maintenance features"""

    connection = op.get_bind()

    # Drop triggers
    tables_with_sequences = [
        "users",
        "patients",
        "practitioners",
        "medications",
        "lab_results",
        "lab_result_files",
        "conditions",
        "allergies",
        "immunizations",
        "procedures",
        "treatments",
        "encounters",
    ]

    for table_name in tables_with_sequences:
        connection.execute(
            text(
                f"DROP TRIGGER IF EXISTS maintain_sequence_{table_name} ON {table_name};"
            )
        )

    # Drop functions and views
    connection.execute(
        text("DROP FUNCTION IF EXISTS maintain_sequence_integrity() CASCADE;")
    )
    connection.execute(text("DROP FUNCTION IF EXISTS fix_all_sequences() CASCADE;"))
    connection.execute(text("DROP VIEW IF EXISTS sequence_status;"))

    print("Sequence maintenance features removed.")
