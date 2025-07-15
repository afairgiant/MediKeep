"""phase_1_patient_ownership

Revision ID: 8658049ceb40
Revises: e409e0efe1d4
Create Date: 2025-07-15 14:40:50.666465

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8658049ceb40'
down_revision = 'e409e0efe1d4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PRE-MIGRATION VERIFICATION
    # Count existing records before migration
    connection = op.get_bind()
    result = connection.execute("SELECT COUNT(*) FROM patients")
    patient_count_before = result.fetchone()[0]
    print(f"✅ Pre-migration: {patient_count_before} patients found")
    
    result = connection.execute("SELECT COUNT(*) FROM users")
    user_count_before = result.fetchone()[0]
    print(f"✅ Pre-migration: {user_count_before} users found")
    
    # Verify no orphaned patients (patients without users)
    result = connection.execute("""
        SELECT COUNT(*) FROM patients p 
        LEFT JOIN users u ON p.user_id = u.id 
        WHERE u.id IS NULL
    """)
    orphaned_patients = result.fetchone()[0]
    if orphaned_patients > 0:
        raise Exception(f"❌ MIGRATION HALTED: {orphaned_patients} orphaned patients found. Fix data integrity first.")
    
    print("✅ Pre-migration verification passed")
    
    # Step 1: Create patient_shares table
    op.create_table('patient_shares',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('patient_id', sa.Integer(), nullable=False),
    sa.Column('shared_by_user_id', sa.Integer(), nullable=False),
    sa.Column('shared_with_user_id', sa.Integer(), nullable=False),
    sa.Column('permission_level', sa.String(), nullable=False),
    sa.Column('custom_permissions', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
    sa.ForeignKeyConstraint(['shared_by_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['shared_with_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('patient_id', 'shared_with_user_id', name='unique_patient_share')
    )
    
    # Step 2: Add nullable columns first to avoid constraint violations
    op.add_column('patients', sa.Column('owner_user_id', sa.Integer(), nullable=True))
    op.add_column('patients', sa.Column('is_self_record', sa.Boolean(), nullable=True))
    op.add_column('patients', sa.Column('family_id', sa.Integer(), nullable=True))
    op.add_column('patients', sa.Column('relationship_to_family', sa.String(), nullable=True))
    op.add_column('patients', sa.Column('privacy_level', sa.String(), nullable=True))
    op.add_column('patients', sa.Column('external_account_id', sa.Integer(), nullable=True))
    op.add_column('patients', sa.Column('is_externally_accessible', sa.Boolean(), nullable=True))
    
    # Step 3: Populate the new fields with existing data
    op.execute("""
        UPDATE patients 
        SET owner_user_id = user_id,
            is_self_record = TRUE,
            privacy_level = 'owner',
            is_externally_accessible = FALSE
        WHERE owner_user_id IS NULL
    """)
    
    # Step 4: Make required fields NOT NULL after populating data
    op.alter_column('patients', 'owner_user_id', nullable=False)
    op.alter_column('patients', 'is_self_record', nullable=False)
    op.alter_column('patients', 'privacy_level', nullable=False)
    op.alter_column('patients', 'is_externally_accessible', nullable=False)
    
    # Step 5: Add foreign key constraint
    op.create_foreign_key('fk_patients_owner_user_id', 'patients', 'users', ['owner_user_id'], ['id'])
    
    # Step 6: Add active_patient_id to users (nullable, no FK constraint yet due to circular dependency)
    op.add_column('users', sa.Column('active_patient_id', sa.Integer(), nullable=True))
    # Note: FK constraint for active_patient_id will be added in a separate migration if needed
    
    # POST-MIGRATION VERIFICATION
    # Verify all existing patients have owner_user_id populated
    result = connection.execute("SELECT COUNT(*) FROM patients WHERE owner_user_id IS NULL")
    null_owners = result.fetchone()[0]
    if null_owners > 0:
        raise Exception(f"❌ MIGRATION FAILED: {null_owners} patients have NULL owner_user_id")
    
    # Verify all existing patients have is_self_record populated
    result = connection.execute("SELECT COUNT(*) FROM patients WHERE is_self_record IS NULL")
    null_self_records = result.fetchone()[0]
    if null_self_records > 0:
        raise Exception(f"❌ MIGRATION FAILED: {null_self_records} patients have NULL is_self_record")
    
    # Verify record counts match
    result = connection.execute("SELECT COUNT(*) FROM patients")
    patient_count_after = result.fetchone()[0]
    if patient_count_before != patient_count_after:
        raise Exception(f"❌ MIGRATION FAILED: Patient count mismatch. Before: {patient_count_before}, After: {patient_count_after}")
    
    result = connection.execute("SELECT COUNT(*) FROM users")
    user_count_after = result.fetchone()[0]
    if user_count_before != user_count_after:
        raise Exception(f"❌ MIGRATION FAILED: User count mismatch. Before: {user_count_before}, After: {user_count_after}")
    
    # Verify all owner_user_id values are valid user IDs
    result = connection.execute("""
        SELECT COUNT(*) FROM patients p 
        LEFT JOIN users u ON p.owner_user_id = u.id 
        WHERE u.id IS NULL
    """)
    invalid_owners = result.fetchone()[0]
    if invalid_owners > 0:
        raise Exception(f"❌ MIGRATION FAILED: {invalid_owners} patients have invalid owner_user_id")
    
    print("✅ Post-migration verification passed")
    print(f"✅ Migration successful: {patient_count_after} patients, {user_count_after} users")
    print("✅ All existing data preserved and enhanced with new ownership fields")


def downgrade() -> None:
    # Step 1: Remove active_patient_id from users (no FK constraint to drop)
    op.drop_column('users', 'active_patient_id')
    
    # Step 2: Drop foreign key constraint from patients
    op.drop_constraint('fk_patients_owner_user_id', 'patients', type_='foreignkey')
    
    # Step 3: Remove columns from patients table
    op.drop_column('patients', 'is_externally_accessible')
    op.drop_column('patients', 'external_account_id')
    op.drop_column('patients', 'privacy_level')
    op.drop_column('patients', 'relationship_to_family')
    op.drop_column('patients', 'family_id')
    op.drop_column('patients', 'is_self_record')
    op.drop_column('patients', 'owner_user_id')
    
    # Step 4: Drop patient_shares table
    op.drop_table('patient_shares')
