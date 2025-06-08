@echo off
echo Activating virtual environment and starting FastAPI backend...
cd /d "e:\Software\Projects\Medical Records-V2"
call .venv\Scripts\activate
echo Virtual environment activated.
echo Starting FastAPI server on http://localhost:8000
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
