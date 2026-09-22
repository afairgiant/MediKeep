"""Shared fixtures for service-layer tests."""

import subprocess

import pytest

CONN_PARAMS = {
    "hostname": "db.example.internal",
    "port": "5432",
    "username": "medikeep",
    "password": "s3cret",
    "database": "medical_records",
}


@pytest.fixture
def conn_params():
    """Validated connection params as SecurityValidator returns them."""
    return dict(CONN_PARAMS)


@pytest.fixture
def completed_process():
    """Factory for a successful subprocess.run result."""

    def _make(stdout="", stderr=""):
        return subprocess.CompletedProcess(
            args=[], returncode=0, stdout=stdout, stderr=stderr
        )

    return _make
