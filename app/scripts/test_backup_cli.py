#!/usr/bin/env python3
"""
Test Script for Backup CLI

This script validates that the backup CLI is working correctly.
Run this before using the backup automation in production.
"""

import json
import subprocess
import sys
from pathlib import Path


def run_command(cmd, description):
    """Run a command and report the result."""
    print(f"\nTesting: {description}")
    print(f"   Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300
        )  # 5 minute timeout

        if result.returncode == 0:
            print(f"   SUCCESS!")

            # Try to parse JSON output if it looks like JSON
            if result.stdout.strip().startswith("{"):
                try:
                    data = json.loads(result.stdout)
                    if "filename" in data:
                        print(f"   Created: {data['filename']}")
                    if "size_bytes" in data:
                        size_mb = data["size_bytes"] / 1024 / 1024
                        print(f"   Size: {size_mb:.1f} MB")
                except json.JSONDecodeError:
                    pass

            if result.stdout.strip():
                print(f"   Output: {result.stdout.strip()}")

        else:
            print(f"   FAILED (exit code: {result.returncode})")
            if result.stderr.strip():
                print(f"   Error: {result.stderr.strip()}")
            if result.stdout.strip():
                print(f"   Output: {result.stdout.strip()}")

        return result.returncode == 0

    except subprocess.TimeoutExpired:
        print(f"   TIMEOUT (command took longer than 5 minutes)")
        return False
    except Exception as e:
        print(f"   Exception: {e}")
        return False


def main():
    print("Backup CLI Test Suite")
    print("=" * 50)

    # Find the script directory
    script_dir = Path(__file__).parent
    cli_script = script_dir / "backup_cli.py"

    if not cli_script.exists():
        print(f"ERROR: CLI script not found at: {cli_script}")
        sys.exit(1)

    print(f"Testing script at: {cli_script}")

    tests = [
        # Test help and basic functionality
        ([sys.executable, str(cli_script), "--help"], "CLI help output"),
        # Test JSON output for each backup type
        (
            [
                sys.executable,
                str(cli_script),
                "database",
                "--json",
                "--description",
                "Test database backup",
            ],
            "Database backup (JSON)",
        ),
        (
            [
                sys.executable,
                str(cli_script),
                "files",
                "--json",
                "--description",
                "Test files backup",
            ],
            "Files backup (JSON)",
        ),
        (
            [
                sys.executable,
                str(cli_script),
                "full",
                "--json",
                "--description",
                "Test full backup",
            ],
            "Full backup (JSON)",
        ),
        # Test wrapper scripts if they exist
    ]

    # Add wrapper script tests if they exist
    for script_name in ["backup_db", "backup_files", "backup_full"]:
        wrapper_script = script_dir / script_name
        if wrapper_script.exists():
            tests.append(
                (
                    [sys.executable, str(wrapper_script), "Test wrapper script"],
                    f"Wrapper script: {script_name}",
                )
            )

    # Run all tests
    passed = 0
    total = len(tests)

    for cmd, description in tests:
        success = run_command(cmd, description)
        if success:
            passed += 1

    # Summary
    print("\n" + "=" * 50)
    print(f"Test Results: {passed}/{total} passed")

    if passed == total:
        print("All tests passed! The backup CLI is ready for production use.")
        print("\nNext steps:")
        print("   - Set up cron jobs for automated backups")
        print("   - Configure backup retention policies")
        print("   - Test restore procedures")
        sys.exit(0)
    else:
        print(
            "Some tests failed. Please check the configuration before using in production."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
