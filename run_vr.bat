@echo off
chcp 65001 >nul
title FutureCareerXR - VR Mode (HTTPS)
echo ===============================================
echo   FutureCareerXR - VR MODE (HTTPS)
echo ===============================================
echo Installing/checking dependencies...
cd /d "%~dp0backend"
python -m pip install -r requirements.txt
python -m pip install cryptography
echo.
set VR_HTTPS=1
python app.py
pause
