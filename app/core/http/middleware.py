from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """Middleware to handle trailing slash redirects for API routes"""

    async def dispatch(self, request: Request, call_next):
        url_path = str(
            request.url.path
        )  # For routes that should NOT have trailing slashes, remove them
        no_slash_routes = [
            "/api/v1/patients/me/",
            "/api/v1/auth/login/",
            "/api/v1/auth/logout/",
            "/api/v1/health/",
        ]

        if url_path in no_slash_routes:
            redirect_url = str(request.url).replace(url_path, url_path.rstrip("/"))
            return RedirectResponse(
                url=redirect_url, status_code=307
            )  # 307 preserves the HTTP method

        # For specific API routes that need trailing slashes, add them
        if (
            url_path.startswith("/api/v1/patients/")
            and not url_path.endswith("/")
            and not url_path.endswith("/me")  # Don't add slash to /patients/me
        ):
            # Check if this is a patient sub-resource route that needs trailing slash
            path_parts = url_path.split("/")
            if (
                len(path_parts) >= 5 and path_parts[4].isdigit()
            ):  # /api/v1/patients/{id}/...
                sub_resource_routes = [
                    "medications",
                    "treatments",
                    "procedures",
                    "allergies",
                    "conditions",
                    "immunizations",
                    "encounters",
                    "lab-results",
                ]
                if len(path_parts) == 6 and path_parts[5] in sub_resource_routes:
                    redirect_url = str(request.url).replace(url_path, url_path + "/")
                    return RedirectResponse(
                        url=redirect_url, status_code=307
                    )  # 307 preserves the HTTP method

        response = await call_next(request)
        return response
