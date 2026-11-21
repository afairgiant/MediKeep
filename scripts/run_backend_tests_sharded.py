#!/usr/bin/env python3
"""Run the backend pytest suite as several concurrent shards.

A serial ``pytest tests`` run takes 10+ minutes. This script splits the test
files into shards (6 by default) and runs one pytest process per shard at the
same time, which brings a full run down to a few minutes.

Why each shard gets its own copy of the repository:
    ``tests/conftest.py`` uses the SQLite file ``test_database.db`` relative to
    the current working directory and deletes it when a session starts. Shards
    sharing one directory would delete each other's database, so every shard
    runs from its own copy of the working tree in a temporary directory.
    Symlinks are not an option: the app resolves paths against the project
    root and rejects files that resolve outside it.

What is copied:
    Every file git knows about or would add (tracked files plus untracked files
    that are not ignored), so uncommitted changes are included. ``.env`` is
    copied too, so the shards see the same settings as a plain pytest run.

Usage:
    python scripts/run_backend_tests_sharded.py
    python scripts/run_backend_tests_sharded.py --shards 4
    python scripts/run_backend_tests_sharded.py tests/api tests/crud
    python scripts/run_backend_tests_sharded.py -- -x -k "medication"

Arguments after ``--`` are passed to every pytest process unchanged.

Exit code: 0 when every shard passed; otherwise the highest pytest exit code
from any shard (1 = test failures, 2-4 = a shard was interrupted or could not
run). Logs are kept after the run and their location is printed at the end.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEST_PATHS = ("tests",)
DEFAULT_SHARDS = 6
TEST_FILE_PATTERNS = ("test_*.py", "*_test.py")
# Gitignored files that a plain pytest run in the repo would still see.
EXTRA_SNAPSHOT_FILES = (".env",)
BASE_PYTEST_ARGS = ("-q", "-rfE", "-p", "no:cacheprovider")
POLL_INTERVAL_SECONDS = 0.5
TERMINATE_TIMEOUT_SECONDS = 10

PYTEST_EXIT_NO_TESTS = 5
EXIT_INTERRUPTED = 130

SHORT_SUMMARY_MARKER = "short test summary info"
SUMMARY_COUNT_RE = re.compile(
    r"(\d+) (failed|passed|skipped|deselected|xfailed|xpassed|errors?|warnings?)"
)
COUNT_ORDER = (
    "failed",
    "errors",
    "passed",
    "skipped",
    "xfailed",
    "xpassed",
    "deselected",
    "warnings",
)


def discover_test_files(root, paths):
    """Return the test files under ``paths`` as sorted, root-relative POSIX paths.

    A path may be a directory (searched recursively for pytest's default
    ``test_*.py`` / ``*_test.py`` patterns) or a single test file.
    """
    found = set()
    for raw in paths:
        path = (root / raw).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Test path does not exist: {raw}")
        if path.is_file():
            found.add(path)
            continue
        for pattern in TEST_FILE_PATTERNS:
            for candidate in path.rglob(pattern):
                if "__pycache__" not in candidate.parts:
                    found.add(candidate)
    return sorted(p.relative_to(root).as_posix() for p in found)


def partition(weighted_files, shard_count):
    """Split ``(path, weight)`` pairs into ``shard_count`` balanced shards.

    Greedy longest-first packing: each file, heaviest first, goes to the shard
    with the lowest total weight so far. Files inside a shard are sorted so they
    run in the same relative order as in a serial run.
    """
    if shard_count < 1:
        raise ValueError("shard_count must be at least 1")
    shards = [[] for _ in range(shard_count)]
    loads = [0] * shard_count
    for path, weight in sorted(weighted_files, key=lambda item: (-item[1], item[0])):
        lightest = min(range(shard_count), key=lambda i: (loads[i], i))
        shards[lightest].append(path)
        loads[lightest] += weight
    return [sorted(shard) for shard in shards]


def parse_shard_log(text):
    """Extract the final summary line, outcome counts and failed test ids."""
    lines = [line.rstrip() for line in text.splitlines()]
    summary = next((line.strip("= ") for line in reversed(lines) if line.strip()), "")

    counts = {}
    for number, outcome in SUMMARY_COUNT_RE.findall(summary):
        if outcome in ("error", "warning"):
            outcome += "s"
        counts[outcome] = counts.get(outcome, 0) + int(number)

    failures = []
    in_short_summary = False
    for line in lines:
        if SHORT_SUMMARY_MARKER in line:
            in_short_summary = True
        elif in_short_summary and line.startswith(("FAILED ", "ERROR ")):
            failures.append(line)
    return summary, counts, failures


def format_counts(counts):
    return (
        ", ".join(f"{counts[key]} {key}" for key in COUNT_ORDER if counts.get(key))
        or "no tests ran"
    )


def combined_exit_code(return_codes):
    """0 if every shard passed; otherwise the highest real pytest exit code.

    A shard that collected no tests (exit 5, e.g. everything deselected by
    ``-k``) counts as passing unless every shard did so.
    """
    meaningful = [rc for rc in return_codes if rc != PYTEST_EXIT_NO_TESTS]
    if not meaningful:
        return PYTEST_EXIT_NO_TESTS
    return max(meaningful)


def list_snapshot_files(root):
    """Return the root-relative paths to copy into each shard."""
    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError(
            "Could not list repository files with git. Run this script from a "
            "git checkout with git on PATH."
        ) from exc

    names = [name for name in result.stdout.decode("utf-8").split("\0") if name]
    names.extend(EXTRA_SNAPSHOT_FILES)
    # Tracked files deleted in the working tree are still listed by git.
    return sorted({name for name in names if (root / name).is_file()})


def copy_snapshot(root, files, destination):
    created_dirs = set()
    for name in files:
        target = destination / name
        if target.parent not in created_dirs:
            target.parent.mkdir(parents=True, exist_ok=True)
            created_dirs.add(target.parent)
        shutil.copy2(root / name, target)


def terminate_all(processes):
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try:
            process.wait(timeout=TERMINATE_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def remove_tree(path):
    shutil.rmtree(path, ignore_errors=True)
    if path.exists():
        print(f"Warning: could not fully remove {path}; delete it manually.")


def run_shards(shards, work_dir, log_dir, pytest_args):
    """Start every shard, wait for all of them and return their exit codes."""
    total = len(shards)
    processes = []
    log_handles = []
    started = time.monotonic()
    # Redirected output would otherwise use the Windows ANSI code page, and
    # non-ASCII text in test output would make pytest fail to write its log.
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        for index, files in enumerate(shards, start=1):
            log_handle = open(log_dir / f"shard_{index}.log", "w", encoding="utf-8")
            log_handles.append(log_handle)
            command = [
                sys.executable,
                "-m",
                "pytest",
                *files,
                *BASE_PYTEST_ARGS,
                *pytest_args,
            ]
            processes.append(
                subprocess.Popen(
                    command,
                    cwd=work_dir / f"shard_{index}",
                    env=env,
                    stdout=log_handle,
                    stderr=subprocess.STDOUT,
                )
            )

        return_codes = [None] * total
        while None in return_codes:
            for index, process in enumerate(processes):
                if return_codes[index] is not None:
                    continue
                rc = process.poll()
                if rc is None:
                    continue
                return_codes[index] = rc
                log_handles[index].close()
                log_text = (log_dir / f"shard_{index + 1}.log").read_text(
                    encoding="utf-8", errors="replace"
                )
                summary, _, _ = parse_shard_log(log_text)
                elapsed = time.monotonic() - started
                print(
                    f"[shard {index + 1}/{total}] finished after {elapsed:.0f}s "
                    f"(exit {rc}): {summary}",
                    flush=True,
                )
            time.sleep(POLL_INTERVAL_SECONDS)
        return return_codes
    except KeyboardInterrupt:
        print("\nInterrupted; stopping shards...", flush=True)
        terminate_all(processes)
        raise
    finally:
        for handle in log_handles:
            handle.close()


def print_report(return_codes, log_dir, elapsed):
    totals = {}
    failures = []
    broken_shards = []
    for index, rc in enumerate(return_codes, start=1):
        log_path = log_dir / f"shard_{index}.log"
        text = log_path.read_text(encoding="utf-8", errors="replace")
        _, counts, shard_failures = parse_shard_log(text)
        for key, value in counts.items():
            totals[key] = totals.get(key, 0) + value
        failures.extend(shard_failures)
        if rc not in (0, 1, PYTEST_EXIT_NO_TESTS):
            broken_shards.append((index, rc, log_path))

    print()
    print(f"All shards finished in {elapsed:.0f}s: {format_counts(totals)}")
    if failures:
        print()
        print("Failures and errors:")
        for line in sorted(failures):
            print(f"  {line}")
    if broken_shards:
        print()
        print("These shards did not run to completion; read their logs:")
        for index, rc, log_path in broken_shards:
            print(f"  shard {index} (exit {rc}): {log_path}")
    print()
    print(f"Shard logs: {log_dir}")


def parse_args(argv):
    if "--" in argv:
        split = argv.index("--")
        own_args, pytest_args = argv[:split], argv[split + 1 :]
    else:
        own_args, pytest_args = argv, []

    parser = argparse.ArgumentParser(
        description="Run the backend pytest suite as concurrent shards, each in "
        "its own temporary copy of the repository.",
        epilog="Arguments after -- are passed to every pytest process.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=list(DEFAULT_TEST_PATHS),
        help="test directories or files to run, relative to the repository root "
        "(default: tests)",
    )
    parser.add_argument(
        "--shards",
        type=int,
        default=DEFAULT_SHARDS,
        help=f"number of concurrent pytest processes (default: {DEFAULT_SHARDS})",
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        help="keep the shard copies after the run, for debugging",
    )
    args = parser.parse_args(own_args)
    if args.shards < 1:
        parser.error("--shards must be at least 1")
    return args, pytest_args


def main(argv=None):
    args, pytest_args = parse_args(sys.argv[1:] if argv is None else argv)

    try:
        test_files = discover_test_files(REPO_ROOT, args.paths)
        snapshot_files = list_snapshot_files(REPO_ROOT)
    except (FileNotFoundError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    if not test_files:
        print("No test files found.", file=sys.stderr)
        return PYTEST_EXIT_NO_TESTS

    shard_count = min(args.shards, len(test_files))
    weighted = [(name, (REPO_ROOT / name).stat().st_size) for name in test_files]
    shards = partition(weighted, shard_count)

    work_dir = Path(tempfile.mkdtemp(prefix="medikeep-test-shards-"))
    log_dir = work_dir / "logs"
    log_dir.mkdir()
    started = time.monotonic()
    try:
        print(
            f"Copying {len(snapshot_files)} files into {shard_count} shard "
            f"directories under {work_dir}",
            flush=True,
        )
        for index in range(1, shard_count + 1):
            copy_snapshot(REPO_ROOT, snapshot_files, work_dir / f"shard_{index}")

        print(
            f"Running {len(test_files)} test files in {shard_count} shards", flush=True
        )
        return_codes = run_shards(shards, work_dir, log_dir, pytest_args)
        print_report(return_codes, log_dir, time.monotonic() - started)
        return combined_exit_code(return_codes)
    except KeyboardInterrupt:
        print(f"Partial shard logs: {log_dir}")
        return EXIT_INTERRUPTED
    finally:
        if args.keep:
            print(f"Shard copies kept in {work_dir}")
        else:
            for index in range(1, shard_count + 1):
                remove_tree(work_dir / f"shard_{index}")


if __name__ == "__main__":
    sys.exit(main())
