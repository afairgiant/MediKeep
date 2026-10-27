#!/usr/bin/env python3
"""
Two-Factor Reset Script

Turns off two-factor authentication for one user who can no longer sign in, for
example after losing their phone and their backup codes, or after SECRET_KEY changed.
Deletes their authenticator secret and backup codes and signs out all their
sessions. Their password is not changed.

Usage:
    # Docker (from host machine):
    docker exec -it <container_name> python app/scripts/reset_user_mfa.py --username alice

    # Skip the confirmation prompt:
    python app/scripts/reset_user_mfa.py --username alice --yes
"""

import argparse
import sys
from pathlib import Path

# Add the project root to Python path so we can import our app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.api.activity_logging import safe_log_activity
    from app.core.database.database import SessionLocal
    from app.core.logging.config import get_logger, log_security_event
    from app.crud.user import user as user_crud
    from app.models.activity_log import ActionType, EntityType
    from app.services import two_factor_service
except ImportError as e:
    print(f"Error importing app modules: {e}")
    print("Make sure you're running this script from the project root directory.")
    sys.exit(1)


logger = get_logger(__name__, "security")

EXIT_OK = 0
EXIT_NOT_FOUND = 1
EXIT_CANCELLED = 2
EXIT_ERROR = 3


def reset_user_mfa(username: str) -> tuple[int, str]:
    """Remove a user's two-factor and end their sessions. Returns (exit code, message)."""
    db = SessionLocal()
    try:
        target = user_crud.get_by_username(db, username=username)
        if target is None:
            return EXIT_NOT_FOUND, f"No user named '{username}' exists."

        was_enabled = two_factor_service.remove_all(db, target)

        log_security_event(
            logger,
            event="mfa_reset_by_cli",
            user_id=target.id,
            ip_address="cli",
            message=f"Two-factor reset for user '{target.username}' via CLI script",
            username=target.username,
            was_enabled=was_enabled,
        )
        # Actor is the affected user: the script runs with no signed-in session
        safe_log_activity(
            db=db,
            action=ActionType.TWO_FACTOR_RESET,
            entity_type=EntityType.USER,
            entity_obj=target,
            user_id=target.id,
            description="Two-factor authentication reset via reset_user_mfa script (CLI)",
            metadata={"source": "reset_user_mfa_script", "was_enabled": was_enabled},
            request=None,
        )

        if not was_enabled:
            return (
                EXIT_OK,
                f"'{target.username}' did not have two-factor turned on. Any pending "
                "setup was removed and their sessions were signed out.",
            )
        return (
            EXIT_OK,
            f"Two-factor authentication turned off for '{target.username}'. They can "
            "now sign in with their password and set it up again in Settings.",
        )
    except Exception as e:
        db.rollback()
        # Database errors can echo bound values, which include secret material
        return EXIT_ERROR, f"Error resetting two-factor: {type(e).__name__}"
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Turn off two-factor authentication for a user who cannot sign in, "
            "and sign out all their sessions."
        ),
    )
    parser.add_argument("--username", required=True, help="The user to reset")
    parser.add_argument(
        "--yes", action="store_true", help="Do not ask for confirmation"
    )
    args = parser.parse_args()

    if not args.yes:
        answer = input(
            f"Turn off two-factor authentication for '{args.username}' and sign out "
            "all their sessions? [y/N] "
        )
        if answer.strip().lower() not in ("y", "yes"):
            print("Cancelled. Nothing was changed.")
            return EXIT_CANCELLED

    code, message = reset_user_mfa(args.username)
    print(message)
    return code


if __name__ == "__main__":
    sys.exit(main())
