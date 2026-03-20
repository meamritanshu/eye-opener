@echo off
setlocal
title The Eye Opener - Startup
color 0B

cd /d "%~dp0"

echo.
echo  ========================================
echo   THE EYE OPENER - Starting up...
echo  ========================================
echo.

python --version >nul 2>&1
if errorlevel 1 goto no_python

if not exist ".venv\Scripts\activate.bat" goto create_venv
goto activate_venv

:create_venv
echo [SETUP] Creating virtual environment...
python -m venv .venv
if errorlevel 1 goto venv_fail
echo [SETUP] Virtual environment created.

:activate_venv
call .venv\Scripts\activate.bat

echo [SETUP] Checking dependencies...
python -m pip install -r requirements.txt -q --disable-pip-version-check
if errorlevel 1 goto deps_fail

where playwright >nul 2>&1
if not errorlevel 1 call playwright install chromium --quiet >nul 2>&1

if not exist ".env" goto create_env
goto check_index

:create_env
echo [SETUP] No .env found. Creating from template...
copy .env.example .env >nul
echo.
echo  [ACTION REQUIRED] Open .env and add your API keys before continuing.
echo  Required: GROQ_API_KEY or CEREBRAS_API_KEY
echo  Optional: GITHUB_TOKEN
echo.
notepad .env
echo.
echo  Press any key after saving your .env file...
pause >nul

:check_index
if exist "chroma_db" goto check_ollama
echo.
echo [SETUP] No knowledge base found. Building index...
echo  This will take 3-5 minutes on first run.
echo.
python -m services.indexer
if errorlevel 1 echo [WARNING] Indexer completed with some errors. Continuing anyway...

:check_ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 goto no_ollama
echo.
echo [OK] Ollama detected. Local LLM will be used.
goto launch

:no_ollama
echo.
echo [INFO] Ollama not detected. Using cloud LLM fallback (Groq/Cerebras).
echo  To use local LLM: start Ollama, then restart this script.
echo.

:launch
echo.
echo  ========================================
echo   THE EYE OPENER is starting...
echo   Open: http://localhost:5000
echo  ========================================
echo.

start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:5000"

python app.py
pause
exit /b 0

:no_python
echo [ERROR] Python not found. Install Python 3.11+ from python.org
pause
exit /b 1

:venv_fail
echo [ERROR] Failed to create virtual environment
pause
exit /b 1

:deps_fail
echo [ERROR] Failed to install dependencies
pause
exit /b 1
