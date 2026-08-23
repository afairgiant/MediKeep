"""Validation for the post-authentication return path.

`POST /auth/sso/initiate` accepts a `return_url`, stores it against the OAuth state
parameter, and `/auth/sso/callback` echoes it back so a deep link survives the round
trip. That value is free text from an unauthenticated caller and it is consumed at
the highest-trust moment in the app - immediately after a successful sign-in - so an
unvalidated one is an open redirect.

The frontend runs the same check before navigating (`frontend/src/utils/
safeInternalPath.ts`), and that is the half that protects users. This half is what
survives someone talking to the API directly: a hostile value is rejected at the door
and never enters the state store, so any future consumer inherits the guarantee.

They are not the same function, and should not be made into one. This is a
predicate over a value about to be *stored* - "never persist something that points
off-origin". The frontend one is a normalizer for *navigation* - "produce a path
that is safe to hand the router" - and it also guards a value this module never
sees, the `?next=` the frontend itself puts in the URL. Where they differ, they
differ on purpose:

| Input | Frontend | Here |
|---|---|---|
| `/login` | rejected - returning to the login page is a loop | accepted; loop avoidance is a navigation rule, and a 400 on a merely useless path would be a hard failure where the client already falls back to `/dashboard` |
| `"  /dashboard"` | trimmed, then accepted | rejected - no trimming, so it does not start with `/`. Refusing is the safe direction for a value we are about to store |
| `/a/b/../c` | normalized to `/a/c` | accepted and stored verbatim; the frontend normalizes it on the way out |

What must stay in step is the core rule - nothing with a scheme, a host, or a
protocol-relative form gets through either one.
"""

import re
from urllib.parse import urlsplit

# Longest path we will store. Well past any real route.
MAX_RETURN_URL_LENGTH = 2048

# Characters that make a path unsafe regardless of where they appear:
#   \x00-\x1f, \x7f  control characters, including the tab and newline browsers
#                    strip from URLs - "/\thttps://evil.example" would otherwise be
#                    reinterpreted after stripping
#   \\               backslashes, which some parsers treat as slashes, so
#                    "/\evil.example" resolves off-origin
# One compiled scan rather than a per-character Python loop plus a separate
# membership test: this runs on every /auth/sso/initiate call, which becomes one
# per unauthenticated page load under SSO_AUTO_REDIRECT.
_UNSAFE_CHARS = re.compile(r"[\x00-\x1f\x7f\\]")


def is_safe_return_url(value: object) -> bool:
    """True if `value` is a root-relative internal path safe to store and echo.

    Rejects anything that resolves off-origin. The cases that matter are the ones a
    naive ``startswith("/")`` check misses: ``//evil.example`` and ``/\\evil.example``
    are both absolute URLs to another host.

    Callers decide what an absent value means; this returns False for None.
    """
    if not isinstance(value, str):
        return False

    if len(value) > MAX_RETURN_URL_LENGTH:
        return False

    if _UNSAFE_CHARS.search(value):
        return False

    try:
        parts = urlsplit(value)
    except ValueError:
        return False

    # Catches absolute ("https://evil.example") and protocol-relative
    # ("//evil.example") forms alike.
    if parts.scheme or parts.netloc:
        return False

    # Relative inputs like "../admin" have no scheme or netloc either, so the check
    # above does not establish that the caller gave us a root-relative path.
    return value.startswith("/")
