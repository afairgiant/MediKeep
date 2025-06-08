from fastapi import APIRouter, Request, Form, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.auth import AuthService

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Create web router
web_router = APIRouter(tags=["web"])


@web_router.get("/", response_class=HTMLResponse)
async def login_page(request: Request):
    """Default page - Login form"""
    return templates.TemplateResponse("login.html", {"request": request})


@web_router.get("/login", response_class=HTMLResponse)
async def login_form(request: Request):
    """Login form page"""
    return templates.TemplateResponse("login.html", {"request": request})


@web_router.post("/login")
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """Handle login form submission"""
    # Authenticate user using service
    db_user = AuthService.authenticate_user(db, username=username, password=password)

    if not db_user:
        return templates.TemplateResponse(
            "login.html",
            {
                "request": request,
                "error": "Invalid username or password",
                "username": username,
            },
        )

    # Successful login - redirect to dashboard
    return RedirectResponse(url="/home", status_code=302)


@web_router.get("/home", response_class=HTMLResponse)
async def home_page(request: Request):
    """Home dashboard page"""
    return templates.TemplateResponse("home.html", {"request": request})


@web_router.get("/logout")
async def logout(request: Request):
    """Handle logout - redirect to login page"""
    # In a more sophisticated app, you would clear session/cookies here
    return RedirectResponse(url="/login", status_code=302)
