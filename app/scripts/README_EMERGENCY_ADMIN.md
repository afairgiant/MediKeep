# Emergency Admin Recovery

`create_emergency_admin.py` recovers admin access to MediKeep in one of two
ways depending on current database state:

1. **Promote an existing user to admin** — the recovery path when a user
   (typically the default `admin` account) has been demoted and you have
   lost all admin access. The user's password, email, and other fields are
   **NOT** changed; the user logs in with their existing credentials after
   the script runs.

2. **Create a new admin user** — the fallback path when no user with the
   target username exists. The new user is created with admin role and
   `must_change_password=True`, so they are forced to change the password
   on first login.

The script picks the right path automatically by checking whether the
target username already exists in the database.

## When to use this

Run this script only when:

- The default `admin` account was demoted and you cannot access the admin UI.
- All admin users have been accidentally deleted.
- You are locked out of the admin interface entirely.
- A fresh installation needs a bootstrap admin account.

For any other case, use the admin UI to manage users.

## Command-line options

| Option       | Description                                                                                                                                                                                | Default |
|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|
| `--username` | Username for the target user. If the user exists and is not admin, the script promotes them. If not, the script creates a new admin with this name.                                        | `admin` |
| `--password` | Password for a newly-created user. **Ignored when promoting** an existing user (the existing password is preserved). Prompted interactively if not supplied and a new user will be created. | prompted |
| `--force`    | Create an additional admin user even when one or more admin users already exist. Not needed for the promote path or for fresh installs.                                                    | `false` |
| `--promote`  | Require promotion of an existing user with this username. Returns an error if no such user exists. Automatically enabled when no admin users exist; only needed to promote a user while other admins are already present. | `false` |

The script always validates the database connection first and prints a
summary of current state (total users, admin count, target user status)
before taking any action, so you can see exactly what it will do before
confirming.

## Exit codes

| Code | Meaning                                                                                       |
|------|-----------------------------------------------------------------------------------------------|
| `0`  | Success (user promoted / user created) OR no-op (target already has admin privileges).       |
| `1`  | Real failure: database unreachable, refusal due to missing flag, `--promote` target missing, or other error. |

Note that `--username admin` on a system where `admin` already has admin
privileges exits with code `0` and a "nothing to do" message — it is not
treated as an error.

## Docker usage

The script runs inside the MediKeep container. Use `docker exec -it` so
the interactive confirmation prompt works:

```bash
# Recover the default admin account (promotes if demoted, creates if missing)
docker exec -it medical-records-app python app/scripts/create_emergency_admin.py --username admin

# Create a new admin user non-interactively
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py \
  --username rescue --password "StrongRecovery_2026"

# Explicitly promote a user even when other admins exist
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username bob --promote

# Create an additional admin user when admins already exist
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username extra --force
```

Replace `medical-records-app` with the actual container name shown by
`docker ps`.

## Local / host usage

From the project root, with the virtual environment activated:

```bash
# Recover the default admin account
python app/scripts/create_emergency_admin.py --username admin

# Create a new admin user
python app/scripts/create_emergency_admin.py --username rescue

# (Windows)
.venv/Scripts/python.exe app/scripts/create_emergency_admin.py --username admin
```

A shell wrapper `app/scripts/emergency_admin.sh` is available on
Linux/macOS/Docker and forwards all arguments to the Python script.

## Recovery scenarios

### Scenario 1: Default admin account demoted, no other admins

This is the most common recovery scenario. A user with `username='admin'`
exists in the database but their role is something other than `admin`
(e.g., `user`), and no other admin users exist.

```bash
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username admin
```

The script detects the demoted account, shows a plan like this:

```
============================================================
MediKeep Emergency Admin Recovery
============================================================
  Total users in system:  5
  Admin users in system:  0
  Target username:        admin
  Target user exists:     yes (role='user')

Action: promote existing user 'admin' from role='user' to role='admin'.
        - Password will NOT be changed.
        - Email and other fields will NOT be changed.
        - The user can log in immediately with their existing credentials.

Continue? (yes/no):
```

After confirming, the script flips the role and the user can log in
immediately with their existing password.

### Scenario 2: Promote a non-default user

If your admin username isn't `admin`, pass it explicitly. Promotion is
still automatic when no admin users exist:

```bash
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username alice
```

If other admin users exist and you still want to promote `alice`, use
`--promote`:

```bash
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username alice --promote
```

### Scenario 3: Fresh install, no users at all

On a first-ever install with zero users, the MediKeep startup code creates
a default admin automatically. If for any reason that didn't happen, run:

```bash
docker exec -it medical-records-app python app/scripts/create_emergency_admin.py
```

This creates a new admin user named `admin`, prompting for the password.

### Scenario 4: Admins exist, you want an extra one

Not a true emergency, but supported. Use `--force`:

```bash
docker exec -it medical-records-app \
  python app/scripts/create_emergency_admin.py --username extra_admin --force
```

## Audit logging

Every successful promotion or creation is recorded in two places:

1. **Security log file** (`logs/security.log`) — a structured WARNING-level
   entry with event `emergency_admin_promoted` or `emergency_admin_created`
   plus the target user id, the previous role (for promotion), and whether
   `--force` was used.

2. **Database activity log** (visible in the admin UI's activity log page)
   — a row in the `activity_logs` table with `entity_type='user'`,
   `action='updated'` (promotion) or `action='created'` (creation), a
   human-readable description, and a `metadata.source` field set to
   `emergency_admin_script` so you can filter CLI-originated actions from
   regular UI actions.

Both log entries are emitted with `ip_address='cli'` (security log) or no
request context (activity log) to make the CLI origin explicit.

## Related: startup self-check

Independently of this script, `app/core/database/database.py` runs a
startup check every time MediKeep boots. If no admin users exist but other
users are present, the startup check emits a loud WARNING-level security
event:

- `admin_user_demoted_no_other_admins` — if a user named `admin` exists
  but does not have the admin role.
- `no_admin_users_detected` — if users exist but none have admin role and
  no `admin`-named user exists.

Both warnings include the exact `docker exec` recovery command in the log
message. The startup check intentionally **does not** auto-promote any
user, because the absence of admins may be an intentional operator
decision (e.g., a secondary admin was created and the default `admin`
was deliberately demoted for security, and the secondary admin was later
lost). Only the explicit CLI invocation of this script is treated as
consent to change a user's role.

## Security notes

1. **Not for routine use.** This script is for emergency recovery only.
   All admin management in normal operation should go through the admin UI.
2. **Promotion preserves the existing password.** If the user had changed
   their password before being demoted, they can log in with that password
   immediately after the script runs. No password reset happens.
3. **Creation forces password change.** Newly created admin users are
   created with `must_change_password=True`. They will be redirected to
   the change-password page on first login.
4. **All actions are audited.** See the "Audit logging" section above.
   After an emergency recovery, review the activity log to confirm the
   action matches what you expected.
5. **Use strong passwords for new admins.** Passwords must be at least 8
   characters. Prefer a long, randomly generated value.

## Troubleshooting

### Database connection error

The script prints `Database connection failed: <error>` and exits with
code 1. Check:

```bash
# Is the container running?
docker ps | grep medical-records

# Recent container logs
docker logs --tail 100 medical-records-app

# Database health check from inside the container
docker exec medical-records-app python -c \
  "from app.core.database.database import check_database_connection; print(check_database_connection())"
```

### `User 'admin' already exists with admin privileges. Nothing to do.`

This is the expected message when `admin` already has admin role — there
is nothing for the script to recover. The exit code is `0`, not `1`, so
this is not a failure. If you intended to recover a *different* account,
pass `--username <name>`.

### `--promote` was passed but no such user exists

You passed `--promote --username foo` but no user `foo` exists. Remove
`--promote` to create a new admin user with that name, or pass a username
that actually exists.

### `<N> admin users already exist. Re-run with --promote` or `--force`

The script refuses to promote an existing user or create a new admin when
admins are already present unless you explicitly opt in. This is a safety
guard against accidental privilege changes. Re-run with the flag it
suggests.

### Import errors

```
Error importing app modules: ...
```

Typically means the script was not run from the project root. Either
`cd` to the repo root first, or run via `docker exec` where the working
directory is already correct.
