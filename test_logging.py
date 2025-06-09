"""
Quick test script to verify logging configuration works
"""

import os
import sys
import json
from pathlib import Path

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app.core.logging_config import get_logger


def test_logging():
    """Test the logging configuration"""

    # Test different logger categories
    app_logger = get_logger("test_app", "app")
    security_logger = get_logger("test_security", "security")
    medical_logger = get_logger("test_medical", "medical")

    print("Testing logging configuration...")

    # Test basic logging
    app_logger.info(
        "Application test message",
        extra={"category": "app", "event": "test_event", "user_id": 123},
    )

    # Test security logging
    security_logger.warning(
        "Security test message",
        extra={
            "category": "security",
            "event": "test_login_attempt",
            "user_id": 456,
            "ip": "192.168.1.100",
        },
    )

    # Test medical data logging
    medical_logger.info(
        "Medical data test message",
        extra={
            "category": "medical",
            "event": "test_patient_access",
            "user_id": 789,
            "patient_id": 101,
            "duration": 250,
        },
    )

    print("✓ Logging test completed")

    # Check if log files were created
    logs_dir = Path("./logs")
    if logs_dir.exists():
        log_files = list(logs_dir.glob("*.log"))
        print(f"✓ Log files created: {[f.name for f in log_files]}")

        # Show sample log entry
        if log_files:
            with open(log_files[0], "r", encoding="utf-8") as f:
                lines = f.readlines()
                if lines:
                    print(f"✓ Sample log entry from {log_files[0].name}:")
                    try:
                        log_entry = json.loads(lines[-1])
                        print(json.dumps(log_entry, indent=2))
                    except json.JSONDecodeError:
                        print(lines[-1].strip())
    else:
        print("⚠ Logs directory not found")


if __name__ == "__main__":
    test_logging()
