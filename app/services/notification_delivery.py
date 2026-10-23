"""Apprise delivery restricted to the addresses a channel was validated against."""

from typing import List, Optional, Tuple

from app.core.utils.pinned_dns import pinned_resolution
from app.core.utils.url_security import _IpAddress

# Hostname and the validated addresses a send may connect to
DestinationPin = Tuple[str, List[_IpAddress]]


def notify_pinned(
    apprise_url: str, pin: Optional[DestinationPin], title: str, body: str
) -> bool:
    """Send through Apprise in this thread, connecting only to the pinned addresses.

    A None pin is for fixed-host channels and sends without pinning.
    """
    import apprise

    # Sequential mode keeps the send in this thread, where the pin applies
    apobj = apprise.Apprise(asset=apprise.AppriseAsset(async_mode=False))
    apobj.add(apprise_url)
    if pin is None:
        return apobj.notify(title=title, body=body)
    with pinned_resolution(*pin):
        return apobj.notify(title=title, body=body)
