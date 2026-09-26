from urllib.parse import quote


def content_disposition_header(disposition: str, filename: str) -> str:
    """Build an ASCII-only Content-Disposition value (RFC 6266 / RFC 5987) for any filename."""
    quoted = quote(filename, safe="")
    if quoted == filename:
        return f'{disposition}; filename="{filename}"'
    return f"{disposition}; filename*=utf-8''{quoted}"
