from fastapi import Request

from app.core.config import settings
from app.core.http.auth_codes import AuthErrorCode
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_security_event
from app.core.utils.client_ip import get_client_ip
from app.core.utils.rate_limit import SlidingWindowRateLimiter

logger = get_logger(__name__, "security")


class LoginThrottle:
    """Limits failed password checks per username+IP pair and per client IP.

    Each attempt reserves a slot before the password is checked and gives it back
    when the password was right, so only failures stay counted and parallel guesses
    cannot all pass the check at once. A limit of 0 turns that limit off.
    State is per process and cleared on restart.
    """

    def __init__(
        self, max_per_username: int, max_per_ip: int, window_seconds: int
    ) -> None:
        self.by_username = SlidingWindowRateLimiter(max_per_username, window_seconds)
        self.by_ip = SlidingWindowRateLimiter(max_per_ip, window_seconds)

    def _keys(self, username: str, request: Request):
        client_ip = get_client_ip(request)
        pairs = (
            # Keyed with the IP so one source cannot lock an account out for everyone
            (self.by_username, (username.strip().lower(), client_ip)),
            (self.by_ip, client_ip),
        )
        return [(limiter, key) for limiter, key in pairs if limiter.max_requests > 0]

    def reserve(self, request: Request, username: str) -> None:
        """Count this attempt as a failure until release(); raise 429 if none are left.

        Call before checking the password, so a throttled request learns nothing.
        """
        reserved = []
        for limiter, key in self._keys(username, request):
            if limiter.is_allowed(key):
                reserved.append((limiter, key))
                continue

            for granted, granted_key in reserved:
                granted.release(granted_key)
            rejection = limiter.too_many_requests(
                key,
                "Too many failed sign-in attempts.",
                AuthErrorCode.LOGIN_RATE_LIMITED,
            )
            log_security_event(
                logger,
                "login_rate_limited",
                request,
                f"Too many failed sign-in attempts for username: {username}",
                username=username,
                endpoint=request.url.path,
                retry_after_seconds=rejection.headers["Retry-After"],
            )
            raise rejection

    def release(self, request: Request, username: str) -> None:
        """Give back the slot reserve() took, once the password proved correct."""
        for limiter, key in self._keys(username, request):
            limiter.release(key)

    def reset(self) -> None:
        """Discard all recorded failures. For tests."""
        self.by_username.reset()
        self.by_ip.reset()


login_throttle = LoginThrottle(
    max_per_username=settings.LOGIN_MAX_FAILED_ATTEMPTS,
    max_per_ip=settings.LOGIN_MAX_FAILED_ATTEMPTS_PER_IP,
    window_seconds=settings.LOGIN_FAILED_WINDOW_MINUTES * 60,
)
