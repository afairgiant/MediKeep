"""Every tracked setting the app reads must be reachable from a deployment artifact.

`SSO_RATE_LIMIT_ATTEMPTS` and `SSO_RATE_LIMIT_WINDOW_MINUTES` were read by
config.py, listed in `.env.example`, and documented in the deployment guide --
which then advised raising the limit under `SSO_AUTO_REDIRECT`, where every
unauthenticated page load is one attempt. No compose file and no Unraid template
passed either variable into the container, so an operator following that advice
changed nothing, silently, on the one setting they had been told to change.
`SSO_ISSUER_URL` had the mirror-image gap: passed by compose, required by every
OIDC-family provider, and absent from the example file operators copy.

A unit test cannot catch either: the settings parse correctly, and the code that
reads them works. What was missing was the wiring, which lives in files no test
had ever opened. Hence this one, which reads them.

Scoped to the SSO settings and `TRUSTED_PROXY_IPS`, across the three tracked
artifacts. `dev_docker/` and `docker/dev/` are
gitignored working files -- asserting on those would pass locally and error in
CI, which is its own version of this bug.
"""

import re
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PY = REPO_ROOT / "app" / "core" / "config.py"
COMPOSE = REPO_ROOT / "docker" / "docker-compose.yml"
# The service the application runs in. Asserted to exist before its environment is
# read, so a rename surfaces here rather than silently skipping the check.
APP_SERVICE = "medikeep-app"
UNRAID_TEMPLATE = REPO_ROOT / "docker" / "unraid-template.xml"
ENV_EXAMPLE = REPO_ROOT / "docker" / ".env.example"

# The three ways config.py reads an environment variable. `get_secret` also
# accepts a `<NAME>_FILE` companion, which is a separate mechanism with its own
# commented-out block in the compose file; the plain name is what this checks.
# TRUSTED_PROXY_IPS rides along with the SSO_* names: unset, the app ignores
# forwarded headers, so an operator behind a proxy must be able to find it.
TRACKED = r"SSO_[A-Z0-9_]+|TRUSTED_PROXY_IPS"

ENV_READ = re.compile(
    r"""(?:os\.getenv|get_secret|_strict_bool)\(\s*["'](""" + TRACKED + r""")["']"""
)


@pytest.fixture(scope="module")
def tracked_settings():
    """Every tracked variable config.py reads from the environment."""
    names = set(ENV_READ.findall(CONFIG_PY.read_text(encoding="utf-8")))
    # A guard on the guard: if the extraction breaks, every assertion below
    # would pass vacuously against an empty set.
    assert {
        "SSO_ENABLED",
        "TRUSTED_PROXY_IPS",
    } <= names, "env-var extraction found nothing recognizable"
    return names


def test_compose_passes_every_tracked_setting(tracked_settings):
    """Checked against the application service specifically.

    Not a union across services: the database service passing `SSO_ONLY_MODE` would
    satisfy a union while the application still never saw it. Naming the service means
    a rename fails this test loudly, which is the outcome a union was reaching for and
    did not achieve.
    """
    compose = yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))
    services = compose.get("services") or {}
    assert APP_SERVICE in services, (
        f"docker-compose.yml has no '{APP_SERVICE}' service. If it was renamed, "
        "update APP_SERVICE here — this test cannot check a service it cannot find."
    )

    environment = services[APP_SERVICE].get("environment")
    if isinstance(environment, dict):
        passed = set(environment)
    elif isinstance(environment, list):
        # `- NAME=value` and bare `- NAME` are both legal.
        passed = {entry.split("=", 1)[0] for entry in environment}
    else:
        passed = set()

    missing = sorted(tracked_settings - passed)
    assert not missing, (
        f"docker/docker-compose.yml does not pass {missing} to '{APP_SERVICE}'. "
        "The app reads these, so an operator setting one would see no effect."
    )


def test_unraid_template_offers_every_tracked_setting(tracked_settings):
    targets = set(
        re.findall(
            r'Target="(' + TRACKED + r')"',
            UNRAID_TEMPLATE.read_text(encoding="utf-8"),
        )
    )
    missing = sorted(tracked_settings - targets)
    assert not missing, (
        f"unraid-template.xml has no Config entry for {missing}. Unraid users "
        "configure the container through this file only."
    )


def test_env_example_names_every_tracked_setting(tracked_settings):
    """Commented-out counts -- the point is that the name is discoverable."""
    documented = set(
        re.findall(
            r"^#*\s*(" + TRACKED + r")=",
            ENV_EXAMPLE.read_text(encoding="utf-8"),
            re.MULTILINE,
        )
    )
    missing = sorted(tracked_settings - documented)
    assert not missing, (
        f".env.example never mentions {missing}. It is the file operators copy, "
        "so a setting absent from it is a setting most of them never learn about."
    )
