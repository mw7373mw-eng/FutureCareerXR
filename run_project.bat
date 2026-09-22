@echo off
REM =========================================================
REM Future Career XR - One-click launcher (Windows)
REM =========================================================
REM This script:
REM   1. Moves into the backend folder
REM   2. Installs Python dependencies (if not already installed)
REM   3. Starts the Flask server
REM   4. Opens the project in your default browser
REM =========================================================

echo.
echo ===============================================
echo   FUTURE CAREER XR - Starting local server...
echo ===============================================
echo.

cd /d "%~dp0backend"

echo Installing/checking Python dependencies...
python -m pip install -r requirements.txt

echo.
echo Starting Flask server on http://localhost:5000 ...
echo (Keep this window open while using the app. Press CTRL+C to stop.)
echo.

REM Give the server a moment to boot, then open the browser.
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5000"

python app.py

pause
