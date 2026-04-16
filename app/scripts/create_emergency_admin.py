#!/usr/bin/env python3
"""
Emergency Admin Recovery Script

Recovers admin access to MediKeep in one of two ways:

  1. Promotes an existing user to admin role -- this is the recovery path
     when a user (typically the default 'admin') has been demoted and you
     have lost all admin access. The user's password, email, and other
     fields are NOT changed; the user logs in with their existing
     credentials after this script runs.

  2. Creates a new admin user -- the fallback path when no user with the
     target username exists. The new user is created with
     must_change_password=True and must change their password at first login.

The script picks the right path automatically by checking whether the
target username already exists in the database.

Usage:
    # Docker (from host machine):
    docker exec -it <container_name> python app/scripts/create_emergency_admin.py

    # Directly on the server:
    python app/scripts/create_emergency_admin.py

    # Recover a specific user by name (promotes if exists, creates if not):
    python app/scripts/create_emergency_admin.py --username admin

    # Create a new admin user with a known password (non-interactive):
    python app/scripts/create_emergency_admin.py --username emergency --password "secure_pass_123"

    # Explicitly promote a user to admin even when other admins exist:
    python app/scripts/create_emergency_admin.py --username bob --promote

    # Create an additional admin user even when admins exist (non-emergency):
    python app/scripts/create_emergency_admin.py --username extra_admin --force

Security Note:
    Intended for emergency recovery only. When creating a new user, change
    the password immediately after first login. When promoting, the existing
    password is preserved.
"""

import argparse
import getpass
import sys
from pathlib import Path

# Add the project root to Python path so we can import our app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    from app.api.activity_logging import safe_log_activity
    from app.core.database.database import SessionLocal
    from app.core.logging.config import get_logger, log_security_event
    from app.crud.user import user
    from app.models.activity_log import ActionType, EntityType
    from app.services.auth import AuthService
except ImportError as e:
    print(f"Error importing app modules: {e}")
    print("Make sure you're running this script from the project root directory.")
    sys.exit(1)


logger = get_logger(__name__, "security")


# Possible execution plans determined by peek_system_state(). These drive
# both user-facing messaging and the actual action taken by
# create_emergency_admin().
PLAN_NOOP_ALREADY_ADMIN = "noop_already_admin"
PLAN_PROMOTE = "promote"
PLAN_REFUSE_NEEDS_PROMOTE_FLAG = "refuse_needs_promote_flag"
PLAN_REFUSE_NO_SUCH_USER_TO_PROMOTE = "refuse_no_such_user_to_promote"
PLAN_REFUSE_NEEDS_FORCE = "refuse_needs_force"
PLAN_CREATE = "create"


def check_database_connection():
    """Check if database is accessible."""
    try:
        from sqlalchemy import text

        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


def peek_system_state(username, promote, force):
    """
    Take a read-only snapshot of the user table and decide what action the
    script should take for the given flags.

    Returns a tuple of (plan, total_users, admin_count, existing_user).
    existing_user is the ORM object if a user with that username exists, or
    None. The caller must treat existing_user as detached: this function
    closes the session before returning, so the row cannot be mutated.
    """
    db = SessionLocal()
    try:
        admin_count = user.get_admin_count(db)
        total_users = user.get_total_count(db)
        existing_user = AuthService.get_user_by_username(db, username)
    finally:
        db.close()

    if existing_user is not None:
        if existing_user.role.lower() in ("admin", "administrator"):
            plan = PLAN_NOOP_ALREADY_ADMIN
        elif admin_count == 0 or promote:
            plan = PLAN_PROMOTE
        else:
            plan = PLAN_REFUSE_NEEDS_PROMOTE_FLAG
    else:
        if promote:
            plan = PLAN_REFUSE_NO_SUCH_USER_TO_PROMOTE
        elif admin_count > 0 and not force:
            plan = PLAN_REFUSE_NEEDS_FORCE
        else:
            plan = PLAN_CREATE

    return plan, total_users, admin_count, existing_user


def create_emergency_admin(
    username: str = "admin",
    password: str = "admin123",
    force: bool = False,
    promote: bool = False,
):
    """
    Promote an existing user to admin OR create a new admin user, depending
    on current database state.

    Args:
        username: Username for the target user.
        password: Password for a newly created user. Ignored when promoting.
        force: If True, allow creating an additional admin even when admin
            users already exist.
        promote: If True, require promotion of an existing user with this
            username (returns False if no such user exists). Promotion is
            automatic when no admin users exist, regardless of this flag.

    Returns:
        True on successful promotion or creation, False on no-op or refusal
        (already admin, --promote target missing, admins exist without
        --force, etc).
    """
    if not check_database_connection():
        return False

    db = SessionLocal()
    try:
        admin_count = user.get_admin_count(db)
        existing_user = AuthService.get_user_by_username(db, username)

        # --promote requires a live target
        if promote and not existing_user:
            print(
                f"No user named '{username}' exists. "
                "Remove --promote to create a new admin user with this username."
            )
            return False

        if existing_user:
            if existing_user.role.lower() in ("admin", "administrator"):
                print(
                    f"User '{username}' already has admin privileges. " "Nothing to do."
                )
                return False

            # Existing non-admin user. Promote if safe.
            if admin_count == 0 or promote:
                old_role = existing_user.role
                existing_user.role = "admin"
                db.add(existing_user)
                db.commit()
                db.refresh(existing_user)

                # File-based security audit log
                log_security_event(
                    logger,
                    event="emergency_admin_promoted",
                    user_id=existing_user.id,
                    ip_address="cli",
                    message=(
                        f"User '{username}' (id={existing_user.id}) promoted "
                        f"from role='{old_role}' to role='admin' via emergency script"
                    ),
                    username=username,
                    previous_role=old_role,
                    admin_count_before=admin_count,
                )

                # DB activity log (visible in the admin activity log UI).
                # Actor is the affected user themselves because the script
                # runs from a CLI with no authenticated session. The source
                # metadata field makes the CLI origin explicit.
                safe_log_activity(
                    db=db,
                    action=ActionType.UPDATED,
                    entity_type=EntityType.USER,
                    entity_obj=existing_user,
                    user_id=existing_user.id,
                    description=(
                        f"Role promoted from '{old_role}' to 'admin' via "
                        f"emergency_admin recovery script (CLI)"
                    ),
                    metadata={
                        "source": "emergency_admin_script",
                        "previous_role": old_role,
                        "new_role": "admin",
                        "admin_count_before": admin_count,
                    },
                    request=None,
                )

                print(f"Promoted '{username}' from role='{old_role}' to role='admin'.")
                print("Password, email, and must_change_password were NOT changed.")
                return True

            # Admins exist and --promote was not passed. Refuse for safety.
            print(
                f"User '{username}' exists with role '{existing_user.role}' "
                f"and {admin_count} admin user(s) already exist in the system."
            )
            print("Re-run with --promote to explicitly promote this user anyway.")
            return False

        # No existing user with this name. Creation path.
        if admin_count > 0 and not force:
            print(
                f"{admin_count} admin user(s) already exist in the system. "
                "This script is intended for emergency recovery when no admins exist."
            )
            print("Re-run with --force to create an additional admin user anyway.")
            return False

        # must_change_password=True is set atomically in the same commit as
        # the user row inside create_user -- no second commit needed.
        new_user = AuthService.create_user(
            db,
            username=username,
            password=password,
            is_superuser=True,
            must_change_password=True,
        )

        # File-based security audit log
        log_security_event(
            logger,
            event="emergency_admin_created",
            user_id=new_user.id if new_user is not None else None,
            ip_address="cli",
            message=(
                f"Admin user '{username}' created via emergency script "
                f"(admins before: {admin_count}, force={force})"
            ),
            username=username,
            admin_count_before=admin_count,
            force=force,
        )

        # DB activity log (visible in the admin activity log UI)
        if new_user is not None:
            safe_log_activity(
                db=db,
                action=ActionType.CREATED,
                entity_type=EntityType.USER,
                entity_obj=new_user,
                user_id=new_user.id,
                description=(
                    f"Admin user created via emergency_admin recovery script (CLI)"
                ),
                metadata={
                    "source": "emergency_admin_script",
                    "role": "admin",
                    "must_change_password": True,
                    "admin_count_before": admin_count,
                    "force": force,
                },
                request=None,
            )

        print(f"Created new admin user '{username}'.")
        print("The user will be required to change their password on first login.")
        return True

    except Exception as e:
        print(f"Error during emergency admin operation: {e}")
        return False
    finally:
        db.close()


def _prompt_password():
    """Prompt for a password twice and return it, or None on mismatch/too-short."""
    print("Please enter a password for the new admin account:")
    password = getpass.getpass("Password: ")
    password_confirm = getpass.getpass("Confirm password: ")

    if password != password_confirm:
        print("Passwords do not match. Operation cancelled.")
        return None

    if len(password) < 8:
        print("Password must be at least 8 characters long. Operation cancelled.")
        return None

    return password


def _print_header(username, total_users, admin_count, existing_user):
    """Print the summary banner shown before every action."""
    print("=" * 60)
    print("MediKeep Emergency Admin Recovery")
    print("=" * 60)
    print(f"  Total users in system:  {total_users}")
    print(f"  Admin users in system:  {admin_count}")
    print(f"  Target username:        {username}")
    if existing_user is not None:
        print(f"  Target user exists:     yes (role='{existing_user.role}')")
    else:
        print(f"  Target user exists:     no")
    print()


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Promote an existing user to admin OR create a new admin user, "
            "for emergency recovery when admin access has been lost."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
    Examples:
    # Recover the default 'admin' user (promotes if it exists, creates if not)
    python app/scripts/create_emergency_admin.py --username admin

    # Create a new admin user with an explicit password (non-interactive)
    python app/scripts/create_emergency_admin.py --username rescue --password "secure_123"

    # Explicitly promote a user even when other admins already exist
    python app/scripts/create_emergency_admin.py --username bob --promote

    # Create an additional admin user even when admins exist
    python app/scripts/create_emergency_admin.py --username extra --force

    # Via Docker (from host machine)
    docker exec -it medical-records-app python app/scripts/create_emergency_admin.py --username admin
        """,
    )

    parser.add_argument(
        "--username",
        default="admin",
        help="Username for the target user (default: admin)",
    )
    parser.add_argument(
        "--password",
        help=(
            "Password for a newly created user. Ignored when promoting an "
            "existing user. Prompted interactively if not supplied."
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Create an additional admin user even if admin users already exist",
    )
    parser.add_argument(
        "--promote",
        action="store_true",
        help=(
            "Require promotion of an existing user with this username. "
            "Promotion is automatic when no admins exist; this flag is "
            "only needed to promote a user while other admins already exist."
        ),
    )

    args = parser.parse_args()

    if not check_database_connection():
        print("Cannot connect to database. Please check your configuration.")
        sys.exit(1)

    plan, total_users, admin_count, existing_user = peek_system_state(
        args.username, args.promote, args.force
    )

    _print_header(args.username, total_users, admin_count, existing_user)

    # Handle no-op and refusal branches -- these do not require a password,
    # do not require confirmation, and exit cleanly.
    if plan == PLAN_NOOP_ALREADY_ADMIN:
        print(f"User '{args.username}' already has admin privileges.")
        print("Nothing to do -- admin access is already available via this account.")
        sys.exit(0)

    if plan == PLAN_REFUSE_NEEDS_PROMOTE_FLAG:
        print(
            f"User '{args.username}' exists with role '{existing_user.role}' "
            f"and {admin_count} admin user(s) already exist in the system."
        )
        print("If you really want to promote this user, re-run with --promote.")
        sys.exit(1)

    if plan == PLAN_REFUSE_NO_SUCH_USER_TO_PROMOTE:
        print(f"Cannot promote: no user named '{args.username}' exists.")
        print("Remove --promote to create a new admin user with this name.")
        sys.exit(1)

    if plan == PLAN_REFUSE_NEEDS_FORCE:
        print(
            f"{admin_count} admin user(s) already exist in the system. "
            "This script is intended for emergency recovery when no admins exist."
        )
        print("Re-run with --force to create an additional admin user anyway.")
        sys.exit(1)

    # Describe the action and get confirmation + password (if needed)
    if plan == PLAN_PROMOTE:
        print(
            f"Action: promote existing user '{args.username}' from "
            f"role='{existing_user.role}' to role='admin'."
        )
        print("        - Password will NOT be changed.")
        print("        - Email and other fields will NOT be changed.")
        print(
            "        - The user can log in immediately with their existing credentials."
        )
    elif plan == PLAN_CREATE:
        print(f"Action: create new admin user '{args.username}'.")
        print("        - The user will be created with role='admin'.")
        print(
            "        - The user will be required to change their password on first login."
        )
    print()

    if not args.force:
        confirm = input("Continue? (yes/no): ").strip().lower()
        if confirm not in ("yes", "y"):
            print("Operation cancelled.")
            sys.exit(0)

    # Only the creation path needs a password
    password = None
    if plan == PLAN_CREATE:
        if args.password:
            password = args.password
        else:
            password = _prompt_password()
            if password is None:
                sys.exit(1)

    # Execute
    success = create_emergency_admin(
        username=args.username,
        password=password if password is not None else "",
        force=args.force,
        promote=args.promote,
    )

    if success:
        print()
        if plan == PLAN_PROMOTE:
            print(f"SUCCESS: '{args.username}' now has admin privileges.")
            print("Log in via the MediKeep UI with the user's existing credentials.")
        else:
            print(f"SUCCESS: new admin user '{args.username}' created.")
            print("Log in and change the password immediately.")
        sys.exit(0)
    else:
        print()
        print("Operation failed. See the messages above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
