"""Check password findings with the installed Bandit rules."""

import json
from pathlib import Path
import subprocess
import sys

import pytest


def test_no_hardcoded_password_findings():
    pytest.importorskip("bandit")
    root = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "bandit",
            "-q",
            "-t",
            "B105,B107",
            "-r",
            str(root / "app"),
            "-f",
            "json",
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )
    assert result.returncode in (0, 1), result.stderr
    report = json.loads(result.stdout)
    assert not report["errors"], report["errors"]
    assert not report["results"], report["results"]
