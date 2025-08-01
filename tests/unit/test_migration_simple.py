"""
Simple, focused tests for data migration functionality.
Tests the core logic without complex mocking.
"""

import pytest
import tempfile
import os
from unittest.mock import patch, MagicMock
from datetime import datetime

from app.core.data_migrations import migrate_lab_result_files_to_entity_files


class TestMigrationLogic:
    """Test core migration logic with focused scenarios."""

    def test_no_old_files_scenario(self):
        """Test: No old lab result files exist."""
        with patch('app.core.data_migrations.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # No old files
            mock_db.query.return_value.count.return_value = 0
            
            result = migrate_lab_result_files_to_entity_files()
            
            assert result == (0, [])
            mock_db.query.assert_called_once()

    def test_files_already_migrated_scenario(self):
        """Test: All files have already been migrated."""
        with patch('app.core.data_migrations.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # Mock: 2 lab files, 2 entity files (already migrated)
            lab_count_mock = MagicMock()
            lab_count_mock.count.return_value = 2
            
            entity_count_mock = MagicMock()
            entity_filter_mock = MagicMock()
            entity_filter_mock.count.return_value = 2
            entity_count_mock.filter.return_value = entity_filter_mock
            
            def query_side_effect(model):
                from app.models.models import LabResultFile, EntityFile
                if model == LabResultFile:
                    return lab_count_mock
                elif model == EntityFile:
                    return entity_count_mock
                return MagicMock()
            
            mock_db.query.side_effect = query_side_effect
            
            result = migrate_lab_result_files_to_entity_files()
            
            assert result == (0, [])

    def test_storage_backend_logic(self):
        """Test storage backend detection logic."""
        with patch('app.core.data_migrations.get_db') as mock_get_db, \
             patch('app.core.data_migrations.os.path.exists') as mock_exists:
            
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # Create mock lab file
            mock_lab_file = MagicMock()
            mock_lab_file.lab_result_id = 1
            mock_lab_file.file_name = "test.pdf"
            mock_lab_file.file_path = "/path/to/test.pdf"
            mock_lab_file.file_type = "application/pdf"
            mock_lab_file.file_size = 1024
            mock_lab_file.description = "Test file"
            mock_lab_file.uploaded_at = datetime.now()
            
            # Setup mocks
            lab_count_mock = MagicMock()
            lab_count_mock.count.return_value = 1
            lab_count_mock.all.return_value = [mock_lab_file]
            
            entity_count_mock = MagicMock()
            entity_filter_mock = MagicMock()
            entity_filter_mock.count.return_value = 0
            entity_filter_mock.first.return_value = None
            entity_count_mock.filter.return_value = entity_filter_mock
            
            def query_side_effect(model):
                from app.models.models import LabResultFile, EntityFile
                if model == LabResultFile:
                    return lab_count_mock
                elif model == EntityFile:
                    return entity_count_mock
                return MagicMock()
            
            mock_db.query.side_effect = query_side_effect
            
            # Test file exists on disk (should be local)
            mock_exists.return_value = True
            
            result = migrate_lab_result_files_to_entity_files()
            
            assert result[0] == 1  # 1 file migrated
            assert result[1] == []  # no errors
            
            # Verify EntityFile was created
            mock_db.add.assert_called_once()
            created_file = mock_db.add.call_args[0][0]
            
            # Verify storage backend detection
            assert created_file.storage_backend == "local"
            assert created_file.sync_status == "synced"
            assert created_file.paperless_document_id is None

    def test_missing_file_warning(self):
        """Test that missing files (potential paperless) are handled correctly."""
        with patch('app.core.data_migrations.get_db') as mock_get_db, \
             patch('app.core.data_migrations.os.path.exists') as mock_exists, \
             patch('app.core.data_migrations.logger') as mock_logger:
            
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # Create mock lab file
            mock_lab_file = MagicMock()
            mock_lab_file.lab_result_id = 1
            mock_lab_file.file_name = "missing.pdf"
            mock_lab_file.file_path = "/missing/path.pdf"
            mock_lab_file.file_type = "application/pdf"
            mock_lab_file.file_size = 1024
            mock_lab_file.description = "Missing file"
            mock_lab_file.uploaded_at = datetime.now()
            
            # Setup mocks
            lab_count_mock = MagicMock()
            lab_count_mock.count.return_value = 1
            lab_count_mock.all.return_value = [mock_lab_file]
            
            entity_count_mock = MagicMock()
            entity_filter_mock = MagicMock()
            entity_filter_mock.count.return_value = 0
            entity_filter_mock.first.return_value = None
            entity_count_mock.filter.return_value = entity_filter_mock
            
            def query_side_effect(model):
                from app.models.models import LabResultFile, EntityFile
                if model == LabResultFile:
                    return lab_count_mock
                elif model == EntityFile:
                    return entity_count_mock
                return MagicMock()
            
            mock_db.query.side_effect = query_side_effect
            
            # File doesn't exist on disk
            mock_exists.return_value = False
            
            result = migrate_lab_result_files_to_entity_files()
            
            assert result[0] == 1  # 1 file migrated
            assert result[1] == []  # no errors
            
            # Verify warning was logged (there might be multiple warnings)
            assert mock_logger.warning.call_count >= 1
            warning_calls = [call[0][0] for call in mock_logger.warning.call_args_list]
            assert any("may need manual paperless migration" in msg for msg in warning_calls)
            
            # File still gets migrated as local (safe default)
            mock_db.add.assert_called_once()
            created_file = mock_db.add.call_args[0][0]
            assert created_file.storage_backend == "local"

    def test_data_preservation(self):
        """Test that all important data from lab files is preserved."""
        with patch('app.core.data_migrations.get_db') as mock_get_db, \
             patch('app.core.data_migrations.os.path.exists') as mock_exists:
            
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # Create detailed mock lab file
            test_date = datetime(2023, 5, 15, 14, 30, 0)
            mock_lab_file = MagicMock()
            mock_lab_file.lab_result_id = 42
            mock_lab_file.file_name = "important_results.pdf"
            mock_lab_file.file_path = "/secure/important_results.pdf"
            mock_lab_file.file_type = "application/pdf"
            mock_lab_file.file_size = 2048
            mock_lab_file.description = "Critical test results"
            mock_lab_file.uploaded_at = test_date
            
            # Setup mocks (simplified)
            mock_db.query.return_value.count.side_effect = [1, 0]  # 1 lab, 0 entity
            mock_db.query.return_value.all.return_value = [mock_lab_file]
            mock_db.query.return_value.first.return_value = None
            mock_db.query.return_value.filter.return_value.count.return_value = 0
            mock_db.query.return_value.filter.return_value.first.return_value = None
            
            mock_exists.return_value = True
            
            result = migrate_lab_result_files_to_entity_files()
            
            assert result[0] == 1
            assert result[1] == []
            
            # Verify data preservation
            mock_db.add.assert_called_once()
            created_file = mock_db.add.call_args[0][0]
            
            assert created_file.entity_type == "lab-result"
            assert created_file.entity_id == 42
            assert created_file.file_name == "important_results.pdf"
            assert created_file.file_path == "/secure/important_results.pdf"
            assert created_file.file_type == "application/pdf"
            assert created_file.file_size == 2048
            assert created_file.description == "Critical test results"
            assert created_file.category == "lab-result"
            assert created_file.uploaded_at == test_date
            assert created_file.storage_backend == "local"

    def test_error_handling(self):
        """Test that database errors are handled properly."""
        with patch('app.core.data_migrations.get_db') as mock_get_db:
            mock_db = MagicMock()
            mock_get_db.return_value = iter([mock_db])
            
            # Mock database error
            mock_db.query.side_effect = Exception("Database connection failed")
            
            with pytest.raises(Exception) as exc_info:
                migrate_lab_result_files_to_entity_files()
            
            assert "Database connection failed" in str(exc_info.value)
            mock_db.rollback.assert_called_once()
            mock_db.close.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])