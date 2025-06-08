@echo off
echo Starting Medical Records System...
echo.

echo Starting FastAPI Backend (port 8000)...
start "FastAPI Backend" cmd /k "cd /d \"e:\Software\Projects\Medical Records-V2\" && .venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting React Frontend (port 3000)...
start "React Frontend" cmd /k "cd /d \"e:\Software\Projects\Medical Records-V2\frontend\" && set PATH=C:\Program Files\nodejs;%PATH% && npm start"

echo.
echo Both services are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this launcher...
pause > nul
