"""Shared CSV streaming utilities for admin export endpoints."""

import csv
import io
from typing import Dict, List

from fastapi.responses import StreamingResponse


def stream_csv(headers: List[str], rows: List[Dict[str, str]], filename: str) -> StreamingResponse:
    """Build a StreamingResponse that yields a CSV file row-by-row.

    Args:
        headers: Column header labels for the first row.
        rows: List of dicts keyed by header label. Missing keys default to "".
        filename: Value for the Content-Disposition attachment filename.
    """

    def iter_csv():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for row in rows:
            writer.writerow([row.get(h, "") for h in headers])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
