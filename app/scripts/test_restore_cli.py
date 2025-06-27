#!/usr/bin/env python3
"""
Simple Test for Simplified Restore CLI
"""

import subprocess
import sys
from pathlib import Path


def test_command(cmd, description):
    """Test a command and report result"""
    print(f"Testing: {description}")
    print(f"  Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode == 0:
            print("  SUCCESS")
            if result.stdout.strip():
                lines = result.stdout.strip().split("\n")
                print(f"  Output: {lines[0]}{'...' if len(lines) > 1 else ''}")
        else:
            print("  FAILED")
            if result.stderr.strip():
                print(f"  Error: {result.stderr.strip()}")

        return result.returncode == 0
    except Exception as e:
        print(f"  Exception: {e}")
        return False


def main():
    print("Simple Restore CLI Test")
    print("=" * 30)

    script_dir = Path(__file__).parent
    restore_script = script_dir / "restore_cli.py"
    wrapper_script = script_dir / "restore"

    if not restore_script.exists():
        print(f"Error: {restore_script} not found")
        sys.exit(1)

    tests = [
        ([sys.executable, str(restore_script), "--help"], "Help command"),
        ([sys.executable, str(restore_script), "list"], "List backups"),
    ]

    if wrapper_script.exists():
        tests.append(([sys.executable, str(wrapper_script), "list"], "Wrapper script"))

    passed = 0
    for cmd, description in tests:
        if test_command(cmd, description):
            passed += 1

    print(f"\nResults: {passed}/{len(tests)} tests passed")
    print("\nSimplified restore CLI is ready!")
    print("\nUsage:")
    print("  docker exec container restore list")
    print("  docker exec container restore preview <backup_id>")
    print("  docker exec container restore restore <backup_id> <code>")


if __name__ == "__main__":
    main()
