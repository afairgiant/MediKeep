"""Tests for scripts/run_backend_tests_sharded.py (the sharded backend test runner)."""

import importlib.util
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

SCRIPT_PATH = (
    Path(__file__).resolve().parents[2] / "scripts" / "run_backend_tests_sharded.py"
)


def _load_script():
    spec = importlib.util.spec_from_file_location(
        "run_backend_tests_sharded", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


sharded = _load_script()


@pytest.mark.parametrize(
    "return_codes, expected",
    [
        ([0, 0, 0], 0),
        ([0, 5, 0], 0),  # a shard with nothing selected is not a failure
        ([5, 5], 5),  # but nothing selected anywhere is reported
        ([1, 0, 4], 4),  # highest pytest exit code wins
        ([0, -9, 0], 3),  # a shard killed by a signal must not look like a pass
    ],
)
def test_combined_exit_code(return_codes, expected):
    assert sharded.combined_exit_code(return_codes) == expected


def test_partition_keeps_every_file_once_and_balances_by_weight():
    weighted = [
        ("tests/test_a.py", 50),
        ("tests/test_b.py", 40),
        ("tests/test_c.py", 30),
        ("tests/test_d.py", 20),
        ("tests/test_e.py", 10),
        ("tests/test_f.py", 10),
        ("tests/test_g.py", 5),
    ]
    weights = dict(weighted)

    shards = sharded.partition(weighted, 3)

    flat = [path for shard in shards for path in shard]
    assert sorted(flat) == sorted(weights)
    assert all(shard == sorted(shard) for shard in shards)
    loads = [sum(weights[path] for path in shard) for shard in shards]
    assert max(loads) - min(loads) <= 10


def test_partition_rejects_zero_shards():
    with pytest.raises(ValueError):
        sharded.partition([("tests/test_a.py", 1)], 0)


def test_discover_matches_pytest_patterns_and_skips_other_files(tmp_path):
    for name in (
        "tests/test_a.py",
        "tests/sub/b_test.py",
        "tests/sub/helpers.py",
        "tests/conftest.py",
        "tests/__pycache__/test_a.cpython-310.pyc",
    ):
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")

    assert sharded.discover_test_files(tmp_path, ["tests"]) == [
        "tests/sub/b_test.py",
        "tests/test_a.py",
    ]


def test_discover_rejects_a_missing_path(tmp_path):
    with pytest.raises(FileNotFoundError):
        sharded.discover_test_files(tmp_path, ["tests"])


def test_parse_shard_log_reads_real_pytest_output(tmp_path):
    """Run pytest with the script's own arguments so the parser sees real output.

    The failing test emits an ERROR log record. Pytest prints it in the
    "Captured log call" section as a line starting with "ERROR", and the parser
    must not count it as an errored test.
    """
    (tmp_path / "test_sample.py").write_text(textwrap.dedent("""
            import logging
            import warnings

            import pytest


            @pytest.fixture
            def broken():
                raise RuntimeError("fixture failed")


            def test_fails():
                logging.getLogger("app.example").error("captured log line")
                assert 1 == 2


            def test_errors(broken):
                pass


            @pytest.mark.parametrize("n", [1, 2])
            def test_warns(n):
                warnings.warn(f"warning {n}")
            """))
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "test_sample.py",
            *sharded.BASE_PYTEST_ARGS,
            # Keeps plugin config warnings out of the warning count.
            "-p",
            "no:asyncio",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert "ERROR    app.example" in result.stdout

    summary, counts, failures = sharded.parse_shard_log(result.stdout)

    assert counts == {"failed": 1, "errors": 1, "passed": 2, "warnings": 2}
    assert summary.startswith("1 failed, 2 passed, 2 warnings, 1 error in ")
    assert [line.split(" - ")[0] for line in failures] == [
        "FAILED test_sample.py::test_fails",
        "ERROR test_sample.py::test_errors",
    ]
