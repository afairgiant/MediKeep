"""
Test library data integrity validator.

Pure function that detects collisions in test library data that would cause
silent last-write-wins behavior in the canonical matching service's lookup
indices. Stdlib only - safe to run in CI with no pip install.

See docs/superpowers/specs/2026-04-19-test-library-validation-design.md
"""

from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Tuple


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class CollisionResult:
    severity: Severity
    collision_type: str
    key: str
    conflicting_tests: Tuple[str, ...]
    message: str


def _normalize(value: str) -> str:
    return value.strip().lower()


def _dedup_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def validate_test_library(tests: List[Dict[str, Any]]) -> List[CollisionResult]:
    """
    Detect collisions that would cause silent remaps in the canonical matcher.

    Severity rules:
      ERROR   - duplicate test_name, abbreviation, common_name, or test_code
                across different tests (case- and whitespace-insensitive).
      WARNING - cross-field collision: one test's abbreviation equals another
                test's test_name or common_name. Priority rules resolve these
                deterministically, but they're suspicious.
      IGNORED - intra-test duplicates (e.g., "ALT" in both abbreviation and
                common_names of the same test).

    Returns results sorted by (severity, collision_type, key) for stable output.
    Raises TypeError if `tests` is not a list, ValueError if an entry lacks
    `test_name`.
    """
    if not isinstance(tests, list):
        raise TypeError(f"tests must be a list, got {type(tests).__name__}")

    # Owner map: normalized key -> list of (canonical_name, field) pairs,
    # deduplicated within each test (intra-test dups ignored).
    test_name_owners: Dict[str, List[str]] = defaultdict(list)
    abbrev_owners: Dict[str, List[str]] = defaultdict(list)
    common_name_owners: Dict[str, List[str]] = defaultdict(list)
    test_code_owners: Dict[str, List[str]] = defaultdict(list)

    for idx, entry in enumerate(tests):
        if "test_name" not in entry:
            raise ValueError(f"Entry at index {idx} missing required field 'test_name'")

        canonical = entry["test_name"]
        tn_key = _normalize(canonical)
        if not tn_key:
            raise ValueError(f"Entry at index {idx} has empty 'test_name'")
        test_name_owners[tn_key].append(canonical)

        abbrev_raw = entry.get("abbreviation")
        if abbrev_raw:
            abbrev_key = _normalize(abbrev_raw)
            if abbrev_key:
                abbrev_owners[abbrev_key].append(canonical)

        raw_common = entry.get("common_names") or []
        normalized_commons = _dedup_preserve_order(
            k for k in (_normalize(c) for c in raw_common) if k
        )
        for c_key in normalized_commons:
            common_name_owners[c_key].append(canonical)

        tc = entry.get("test_code")
        if tc:
            tc_key = _normalize(tc)
            if tc_key:
                test_code_owners[tc_key].append(canonical)

    results: List[CollisionResult] = []

    def _emit_duplicates(
        owners: Dict[str, List[str]], collision_type: str, field_label: str
    ):
        for key, names in owners.items():
            if len(names) > 1:
                unique_names = tuple(sorted(set(names)))
                results.append(
                    CollisionResult(
                        severity=Severity.ERROR,
                        collision_type=collision_type,
                        key=key,
                        conflicting_tests=unique_names,
                        message=(
                            f"{field_label} '{key}' is shared by "
                            f"{len(unique_names)} tests: {', '.join(unique_names)}"
                        ),
                    )
                )

    _emit_duplicates(test_name_owners, "duplicate_test_name", "test_name")
    _emit_duplicates(abbrev_owners, "duplicate_abbreviation", "abbreviation")
    _emit_duplicates(common_name_owners, "duplicate_common_name", "common_name")
    _emit_duplicates(test_code_owners, "duplicate_test_code", "test_code")

    # Cross-field warnings: abbreviation of test A matches test_name or common_name
    # of a *different* test B.
    for abbrev_key, abbrev_owners_list in abbrev_owners.items():
        other_owners = set()
        for name in test_name_owners.get(abbrev_key, []):
            other_owners.add((name, "test_name"))
        for name in common_name_owners.get(abbrev_key, []):
            other_owners.add((name, "common_name"))

        abbrev_owner_set = set(abbrev_owners_list)
        foreign = [
            (name, field)
            for (name, field) in other_owners
            if name not in abbrev_owner_set
        ]
        if foreign:
            conflicting = tuple(
                sorted(set(abbrev_owners_list) | {name for name, _ in foreign})
            )
            fields = sorted({field for _, field in foreign})
            results.append(
                CollisionResult(
                    severity=Severity.WARNING,
                    collision_type="cross_field_collision",
                    key=abbrev_key,
                    conflicting_tests=conflicting,
                    message=(
                        f"abbreviation '{abbrev_key}' also appears as "
                        f"{'/'.join(fields)} on a different test: {', '.join(conflicting)}"
                    ),
                )
            )

    results.sort(key=lambda r: (r.severity.value, r.collision_type, r.key))
    return results
