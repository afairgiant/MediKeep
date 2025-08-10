"""
Tests for data migration functionality.
Ensures that lab result files are migrated correctly to the new entity files system.
"""

import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.data_migrations import migrate_lab_result_files_to_entity_files, run_startup_data_migrations
from app.models.models import LabResultFile, EntityFile


class TestLabResultFilesMigration:
    """Test the lab result files to entity files migration."""

    def create_mock_lab_file(self, lab_result_id=1, file_name="test.pdf", file_path="/path/to/test.pdf", file_exists=True):
        """Create a mock LabResultFile for testing."""
        mock_file = MagicMock(spec=LabResultFile)
        mock_file.id = 1
        mock_file.lab_result_id = lab_result_id
        mock_file.file_name = file_name
        mock_file.file_path = file_path
        mock_file.file_type = "application/pdf"
        mock_file.file_size = 1024
        mock_file.description = "Test file"
        mock_file.uploaded_at = datetime.now()
        return mock_file

    def create_mock_entity_file(self, entity_id=1, file_name="test.pdf"):
        """Create a mock EntityFile for testing."""
        mock_file = MagicMock(spec=EntityFile)
        mock_file.id = 1
        mock_file.entity_type = "lab-result"
        mock_file.entity_id = entity_id
        mock_file.file_name = file_name
        mock_file.file_path = "/path/to/test.pdf"
        mock_file.storage_backend = "local"
        return mock_file

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_with_no_old_files(self, mock_exists, mock_get_db):
        """Test migration when there are no old lab result files."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock queries to return empty results
        mock_db.query.return_value.count.return_value = 0
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 0
        assert errors == []
        mock_db.query.assert_called_once()  # Only the count query should be called

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_with_existing_files_on_disk(self, mock_exists, mock_get_db):
        """Test migration when old files exist on disk (local storage)."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock lab files exist
        lab_file = self.create_mock_lab_file()
        
        # Setup query mock properly
        mock_query_lab = MagicMock()
        mock_query_lab.count.return_value = 1
        mock_query_lab.all.return_value = [lab_file]
        
        mock_query_entity = MagicMock()
        mock_query_entity.filter.return_value.count.return_value = 0
        mock_query_entity.filter.return_value.first.return_value = None
        
        # Setup db.query to return different mocks for different models
        def query_side_effect(model):
            if model == LabResultFile:
                return mock_query_lab
            elif model == EntityFile:
                return mock_query_entity
            return MagicMock()
        
        mock_db.query.side_effect = query_side_effect
        
        # Mock file exists on disk
        mock_exists.return_value = True
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 1
        assert errors == []
        
        # Verify EntityFile was created with correct storage backend
        mock_db.add.assert_called_once()
        created_entity_file = mock_db.add.call_args[0][0]
        assert created_entity_file.storage_backend == "local"
        assert created_entity_file.paperless_document_id is None
        assert created_entity_file.sync_status == "synced"
        
        mock_db.commit.assert_called_once()

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_with_missing_files_potential_paperless(self, mock_exists, mock_get_db):
        """Test migration when files don't exist on disk (potential paperless files)."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock lab files exist
        lab_file = self.create_mock_lab_file(file_path="/missing/file.pdf")
        
        # Setup query mock properly
        mock_query_lab = MagicMock()
        mock_query_lab.count.return_value = 1
        mock_query_lab.all.return_value = [lab_file]
        
        mock_query_entity = MagicMock()
        mock_query_entity.filter.return_value.count.return_value = 0
        mock_query_entity.filter.return_value.first.return_value = None
        
        def query_side_effect(model):
            if model == LabResultFile:
                return mock_query_lab
            elif model == EntityFile:
                return mock_query_entity
            return MagicMock()
        
        mock_db.query.side_effect = query_side_effect
        
        # Mock file doesn't exist on disk
        mock_exists.return_value = False
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 1
        assert errors == []
        
        # Verify EntityFile was created with local storage (safe default)
        mock_db.add.assert_called_once()
        created_entity_file = mock_db.add.call_args[0][0]
        assert created_entity_file.storage_backend == "local"  # Safe default
        assert created_entity_file.paperless_document_id is None
        
        mock_db.commit.assert_called_once()

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_idempotency(self, mock_exists, mock_get_db):
        """Test that running migration twice doesn't duplicate files."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock lab files exist
        lab_file = self.create_mock_lab_file()
        entity_file = self.create_mock_entity_file()
        
        mock_db.query.return_value.count.side_effect = [1, 1]  # 1 lab file, 1 entity file (already migrated)
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 0  # Nothing should be migrated
        assert errors == []
        
        # Verify no database operations happened
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_with_duplicate_detection(self, mock_exists, mock_get_db):
        """Test that duplicate files are properly detected and skipped."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock lab files exist
        lab_file = self.create_mock_lab_file()
        existing_entity_file = self.create_mock_entity_file()
        
        mock_db.query.return_value.count.side_effect = [1, 0]  # 1 lab file, 0 entity files in count
        mock_db.query.return_value.all.return_value = [lab_file]
        mock_db.query.return_value.first.return_value = existing_entity_file  # File already exists
        
        mock_exists.return_value = True
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 0  # File already existed, so nothing migrated
        assert errors == []
        
        # Verify no database operations happened
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    @patch('app.core.data_migrations.get_db')
    def test_migration_handles_database_errors(self, mock_get_db):
        """Test that migration handles database errors gracefully."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Mock database error
        mock_db.query.side_effect = Exception("Database error")
        
        # Execute and assert exception is raised
        with pytest.raises(Exception) as exc_info:
            migrate_lab_result_files_to_entity_files()
        
        assert "Database error" in str(exc_info.value)
        mock_db.rollback.assert_called_once()

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_migration_with_multiple_files(self, mock_exists, mock_get_db):
        """Test migration with multiple lab result files."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Create multiple lab files
        lab_file1 = self.create_mock_lab_file(lab_result_id=1, file_name="test1.pdf", file_path="/path/to/test1.pdf")
        lab_file2 = self.create_mock_lab_file(lab_result_id=2, file_name="test2.pdf", file_path="/path/to/test2.pdf")
        lab_file3 = self.create_mock_lab_file(lab_result_id=3, file_name="test3.pdf", file_path="/missing/test3.pdf")
        
        mock_db.query.return_value.count.side_effect = [3, 0]  # 3 lab files, 0 entity files
        mock_db.query.return_value.all.return_value = [lab_file1, lab_file2, lab_file3]
        mock_db.query.return_value.first.return_value = None  # No existing entity files
        
        # Mock file existence - first two exist, third doesn't
        mock_exists.side_effect = lambda path: path != "/missing/test3.pdf"
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 3
        assert errors == []
        
        # Verify all files were added
        assert mock_db.add.call_count == 3
        mock_db.commit.assert_called_once()

    @patch('app.core.data_migrations.migrate_lab_result_files_to_entity_files')
    def test_run_startup_data_migrations_success(self, mock_migrate):
        """Test the startup data migrations runner."""
        # Setup
        mock_migrate.return_value = (5, [])  # 5 files migrated, no errors
        
        # Execute
        run_startup_data_migrations()
        
        # Assert
        mock_migrate.assert_called_once()

    @patch('app.core.data_migrations.migrate_lab_result_files_to_entity_files')
    def test_run_startup_data_migrations_with_errors(self, mock_migrate):
        """Test startup migrations when there are errors."""
        # Setup
        mock_migrate.return_value = (3, ["Error 1", "Error 2"])  # 3 files migrated, 2 errors
        
        # Execute (should not raise exception)
        run_startup_data_migrations()
        
        # Assert
        mock_migrate.assert_called_once()

    @patch('app.core.data_migrations.migrate_lab_result_files_to_entity_files')
    def test_run_startup_data_migrations_handles_failure(self, mock_migrate):
        """Test startup migrations when migration fails."""
        # Setup
        mock_migrate.side_effect = Exception("Migration failed")
        
        # Execute (should not raise exception - should be handled gracefully)
        run_startup_data_migrations()
        
        # Assert
        mock_migrate.assert_called_once()


class TestMigrationDataIntegrity:
    """Test data integrity aspects of the migration."""

    @patch('app.core.data_migrations.get_db')
    @patch('app.core.data_migrations.os.path.exists')
    def test_all_lab_file_fields_preserved(self, mock_exists, mock_get_db):
        """Test that all important fields from LabResultFile are preserved in EntityFile."""
        # Setup
        mock_db = MagicMock(spec=Session)
        mock_get_db.return_value = iter([mock_db])
        
        # Create lab file with all fields
        lab_file = MagicMock(spec=LabResultFile)
        lab_file.lab_result_id = 42
        lab_file.file_name = "important_results.pdf"
        lab_file.file_path = "/secure/path/important_results.pdf"
        lab_file.file_type = "application/pdf"
        lab_file.file_size = 2048
        lab_file.description = "Critical test results"
        lab_file.uploaded_at = datetime(2023, 1, 15, 10, 30, 0)
        
        mock_db.query.return_value.count.side_effect = [1, 0]
        mock_db.query.return_value.all.return_value = [lab_file]
        mock_db.query.return_value.first.return_value = None
        mock_exists.return_value = True
        
        # Execute
        migrated_count, errors = migrate_lab_result_files_to_entity_files()
        
        # Assert
        assert migrated_count == 1
        assert errors == []
        
        # Verify all fields were preserved
        created_entity_file = mock_db.add.call_args[0][0]
        assert created_entity_file.entity_type == "lab-result"
        assert created_entity_file.entity_id == 42
        assert created_entity_file.file_name == "important_results.pdf"
        assert created_entity_file.file_path == "/secure/path/important_results.pdf"
        assert created_entity_file.file_type == "application/pdf"
        assert created_entity_file.file_size == 2048
        assert created_entity_file.description == "Critical test results"
        assert created_entity_file.category == "lab-result"
        assert created_entity_file.uploaded_at == datetime(2023, 1, 15, 10, 30, 0)
        assert created_entity_file.storage_backend == "local"
        assert created_entity_file.sync_status == "synced"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])