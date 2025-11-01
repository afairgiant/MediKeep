"""
Tests for log rotation functionality.

Tests the log rotation configuration, size parsing, method detection,
and handler creation for both logrotate and Python rotation methods.
"""

from unittest.mock import patch

import pytest

from app.core.logging.config import (
    _get_rotation_method,
    _is_logrotate_available,
    _parse_size_string,
)


class TestParseSizeString:
    """Test suite for _parse_size_string function."""

    def test_valid_kilobyte_format(self):
        """Test parsing valid KB sizes."""
        assert _parse_size_string("5K") == 5 * 1024
        assert _parse_size_string("100K") == 100 * 1024
        assert _parse_size_string("1024K") == 1024 * 1024

    def test_valid_megabyte_format(self):
        """Test parsing valid MB sizes."""
        assert _parse_size_string("5M") == 5 * 1024 * 1024
        assert _parse_size_string("50M") == 50 * 1024 * 1024
        assert _parse_size_string("100M") == 100 * 1024 * 1024

    def test_valid_gigabyte_format(self):
        """Test parsing valid GB sizes."""
        assert _parse_size_string("1G") == 1 * 1024 * 1024 * 1024
        assert _parse_size_string("5G") == 5 * 1024 * 1024 * 1024
        assert _parse_size_string("10G") == 10 * 1024 * 1024 * 1024

    def test_plain_bytes_format(self):
        """Test parsing plain byte values."""
        assert _parse_size_string("1024") == 1024
        assert _parse_size_string("5242880") == 5 * 1024 * 1024

    def test_case_insensitive(self):
        """Test that suffixes are case-insensitive."""
        assert _parse_size_string("5k") == 5 * 1024
        assert _parse_size_string("5m") == 5 * 1024 * 1024
        assert _parse_size_string("1g") == 1 * 1024 * 1024 * 1024

    def test_whitespace_handling(self):
        """Test that leading/trailing whitespace is handled."""
        assert _parse_size_string("  5M  ") == 5 * 1024 * 1024
        assert _parse_size_string("\t10K\t") == 10 * 1024

    def test_invalid_empty_string(self):
        """Test that empty string raises ValueError."""
        with pytest.raises(ValueError, match="Size string cannot be empty"):
            _parse_size_string("")
        with pytest.raises(ValueError, match="Size string cannot be empty"):
            _parse_size_string("   ")

    def test_invalid_non_string(self):
        """Test that non-string input raises ValueError."""
        with pytest.raises(ValueError, match="Size must be a string"):
            _parse_size_string(123)
        with pytest.raises(ValueError, match="Size must be a string"):
            _parse_size_string(None)

    def test_invalid_decimal_numbers(self):
        """Test that decimal numbers are rejected."""
        with pytest.raises(ValueError, match="decimal numbers not supported"):
            _parse_size_string("5.5M")
        with pytest.raises(ValueError, match="decimal numbers not supported"):
            _parse_size_string("1.2G")

    def test_invalid_negative_numbers(self):
        """Test that negative numbers are rejected."""
        with pytest.raises(ValueError, match="size must be positive"):
            _parse_size_string("-5M")
        with pytest.raises(ValueError, match="size must be positive"):
            _parse_size_string("-100K")

    def test_invalid_zero(self):
        """Test that zero is rejected."""
        with pytest.raises(ValueError, match="size must be positive"):
            _parse_size_string("0M")
        with pytest.raises(ValueError, match="size must be positive"):
            _parse_size_string("0")

    def test_invalid_too_small(self):
        """Test that sizes below 1KB are rejected."""
        with pytest.raises(ValueError, match="too small"):
            _parse_size_string("512")  # 512 bytes
        with pytest.raises(ValueError, match="too small"):
            _parse_size_string("1")

    def test_invalid_too_large(self):
        """Test that sizes above 10GB are rejected."""
        with pytest.raises(ValueError, match="too large"):
            _parse_size_string("11G")
        with pytest.raises(ValueError, match="too large"):
            _parse_size_string("10241M")  # 10GB + 1MB

    def test_invalid_format(self):
        """Test that invalid formats are rejected."""
        with pytest.raises(ValueError, match="Invalid size format"):
            _parse_size_string("ABC")
        with pytest.raises(ValueError, match="Invalid size format"):
            _parse_size_string("M5")
        with pytest.raises(ValueError, match="Invalid size format"):
            _parse_size_string("5X")

    def test_missing_numeric_part(self):
        """Test that suffix without number is rejected."""
        with pytest.raises(ValueError, match="missing numeric part"):
            _parse_size_string("M")
        with pytest.raises(ValueError, match="missing numeric part"):
            _parse_size_string("K")


class TestIsLogrotateAvailable:
    """Test suite for _is_logrotate_available function."""

    @patch("shutil.which")
    def test_logrotate_available(self, mock_which):
        """Test detection when logrotate is available."""
        mock_which.return_value = "/usr/sbin/logrotate"
        assert _is_logrotate_available() is True
        mock_which.assert_called_once_with("logrotate")

    @patch("shutil.which")
    def test_logrotate_not_available(self, mock_which):
        """Test detection when logrotate is not available."""
        mock_which.return_value = None
        assert _is_logrotate_available() is False
        mock_which.assert_called_once_with("logrotate")


class TestGetRotationMethod:
    """Test suite for _get_rotation_method function."""

    @patch("app.core.logging.config._is_logrotate_available")
    def test_auto_with_logrotate_available(self, mock_logrotate_check):
        """Test auto method selection when logrotate is available."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "auto"
            mock_logrotate_check.return_value = True
            assert _get_rotation_method() == "logrotate"
        finally:
            settings.LOG_ROTATION_METHOD = original_method

    @patch("app.core.logging.config._is_logrotate_available")
    def test_auto_with_logrotate_unavailable(self, mock_logrotate_check):
        """Test auto method selection when logrotate is not available."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "auto"
            mock_logrotate_check.return_value = False
            assert _get_rotation_method() == "python"
        finally:
            settings.LOG_ROTATION_METHOD = original_method

    def test_explicit_logrotate_method(self):
        """Test explicit logrotate method selection."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "logrotate"
            assert _get_rotation_method() == "logrotate"
        finally:
            settings.LOG_ROTATION_METHOD = original_method

    def test_explicit_python_method(self):
        """Test explicit Python method selection."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "python"
            assert _get_rotation_method() == "python"
        finally:
            settings.LOG_ROTATION_METHOD = original_method

    @patch("app.core.logging.config._is_logrotate_available")
    def test_invalid_method_fallback(self, mock_logrotate_check):
        """Test that invalid method falls back to auto detection."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "invalid_method"
            mock_logrotate_check.return_value = True
            assert _get_rotation_method() == "logrotate"
        finally:
            settings.LOG_ROTATION_METHOD = original_method

    @patch("app.core.logging.config._is_logrotate_available")
    def test_case_insensitive_method(self, mock_logrotate_check):
        """Test that method names are case-insensitive."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = "AUTO"
            mock_logrotate_check.return_value = False
            assert _get_rotation_method() == "python"

            settings.LOG_ROTATION_METHOD = "PYTHON"
            assert _get_rotation_method() == "python"

            settings.LOG_ROTATION_METHOD = "LOGROTATE"
            assert _get_rotation_method() == "logrotate"
        finally:
            settings.LOG_ROTATION_METHOD = original_method


class TestLoggingConfigSetup:
    """Test suite for LoggingConfig initialization and setup."""

    def test_logging_config_initializes(self):
        """Test that LoggingConfig can be initialized without errors."""
        # This is a smoke test - we just want to ensure initialization doesn't fail
        # More detailed tests would require mocking the entire logging system
        from app.core.logging.config import logging_config

        # logging_config is already initialized at module import
        # Just verify it has expected attributes
        assert hasattr(logging_config, 'log_dir')
        assert hasattr(logging_config, 'log_level')
        assert logging_config.log_dir is not None


class TestEdgeCases:
    """Test suite for edge cases and error handling."""

    def test_boundary_values(self):
        """Test boundary values for size parsing."""
        # Minimum valid size (1KB)
        assert _parse_size_string("1K") == 1024

        # Maximum valid size (10GB)
        assert _parse_size_string("10G") == 10 * 1024 * 1024 * 1024

    def test_size_conversion_accuracy(self):
        """Test that size conversions are accurate."""
        # Test precise conversions
        assert _parse_size_string("1024K") == 1 * 1024 * 1024  # 1MB
        assert _parse_size_string("1024M") == 1 * 1024 * 1024 * 1024  # 1GB

    def test_empty_rotation_method(self):
        """Test handling of empty rotation method string."""
        from app.core.config import settings
        original_method = settings.LOG_ROTATION_METHOD
        try:
            settings.LOG_ROTATION_METHOD = ""
            # Should fall back to auto detection
            method = _get_rotation_method()
            assert method in ["python", "logrotate"]
        finally:
            settings.LOG_ROTATION_METHOD = original_method
