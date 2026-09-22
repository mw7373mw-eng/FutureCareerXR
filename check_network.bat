@echo off
chcp 65001 >nul
title FutureCareerXR - Network Check
cd /d "%~dp0backend"
python check_network.py
